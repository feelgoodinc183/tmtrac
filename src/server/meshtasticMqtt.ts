/**
 * Decoding of Meshtastic MQTT traffic for the server-side bridge.
 *
 * Gateways publish each LoRa packet they hear as a protobuf ServiceEnvelope on
 *   msh/<region>/2/e/<channel name>/<gateway id>
 * The packet inside is AES-CTR encrypted with the channel key, exactly as on the radio:
 *   key   = the channel PSK (1-byte PSKs expand from the well-known default key)
 *   nonce = packet id (uint64 LE) | sender node number (uint32 LE) | 4 zero bytes
 * Some gateways also publish JSON on msh/<region>/2/json/<channel>/<gateway>.
 *
 * Positions on the public default key are limited by the firmware and the public broker to
 * 10-16 bits of precision (hundreds of metres to kilometres), so they are only good for
 * "who is nearby", not for racing. Every update carries the reported precision.
 */
import { createDecipheriv } from 'node:crypto';
import {
  PortNum,
  decodeData,
  decodePosition,
  decodeServiceEnvelope,
  decodeTelemetry,
  decodeUser,
  hardwareModelName,
  positionErrorMeters,
  positionLatLng,
  positionSpeedKt,
  positionTrackDeg,
  hopsTaken,
  KMH_TO_KT,
  BROADCAST_NUM,
  DataMsg,
} from '../services/meshtastic/protocol';
import { canonicalNodeId } from '../utils/nodeId';

/** The firmware's default channel key, used when a channel's PSK is the single byte 1 ("AQ==") */
export const DEFAULT_PSK = Buffer.from([
  0xd4, 0xf1, 0xbb, 0x3a, 0x20, 0x29, 0x07, 0x59, 0xf0, 0xbc, 0xff, 0xab, 0xcf, 0x4e, 0x69, 0x01,
]);

/**
 * Turns a channel PSK (base64, as shown in the Meshtastic apps) into the AES key the radio uses.
 * Returns null for "no encryption" and throws for a malformed key.
 */
export function expandPsk(pskBase64: string): Buffer | null {
  const psk = Buffer.from((pskBase64 || '').trim(), 'base64');
  if (psk.length === 0) return null;
  if (psk.length === 1) {
    const index = psk[0];
    if (index === 0) return null;
    const key = Buffer.from(DEFAULT_PSK);
    key[key.length - 1] = (key[key.length - 1] + index - 1) & 0xff;
    return key;
  }
  if (psk.length === 16 || psk.length === 32) return psk;
  if (psk.length < 16) return Buffer.concat([psk, Buffer.alloc(16 - psk.length)]);
  if (psk.length < 32) return Buffer.concat([psk, Buffer.alloc(32 - psk.length)]);
  throw new Error('Channel key is longer than 32 bytes');
}

function xorHash(bytes: Uint8Array): number {
  let h = 0;
  for (const b of bytes) h ^= b;
  return h;
}

/** MeshPacket.channel on encrypted packets: XOR of the channel name bytes and the key bytes */
export function channelHash(name: string, key: Buffer | null): number {
  return (xorHash(Buffer.from(name, 'utf8')) ^ (key ? xorHash(key) : 0)) & 0xff;
}

/** AES-CTR with a 16-byte initial counter block (same for encrypt and decrypt) */
export function aesCtr(key: Buffer, counterBlock: Buffer, data: Uint8Array): Buffer {
  const algo = key.length === 32 ? 'aes-256-ctr' : 'aes-128-ctr';
  const decipher = createDecipheriv(algo, key, counterBlock);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

/** The radio's nonce: packet id (uint64 LE, upper half zero) | sender node number (uint32 LE) | 4 zero bytes */
export function packetNonce(fromNode: number, packetId: number): Buffer {
  const nonce = Buffer.alloc(16);
  nonce.writeUInt32LE(packetId >>> 0, 0);
  nonce.writeUInt32LE(fromNode >>> 0, 8);
  return nonce;
}

export function decryptPayload(encrypted: Uint8Array, key: Buffer, fromNode: number, packetId: number): Buffer {
  return aesCtr(key, packetNonce(fromNode, packetId), encrypted);
}

export interface ChannelKey {
  /** Channel name as it appears in the topic, e.g. "LongFast" */
  name: string;
  /** Expanded AES key, or null for an unencrypted channel */
  key: Buffer | null;
}

/** A node update in plain JSON, as sent to rooms over the WebSocket */
export interface BridgeNodeUpdate {
  id: string;
  longName?: string;
  shortName?: string;
  hardwareModel?: string;
  lat?: number;
  lng?: number;
  /** Worst-case error of lat/lng in metres; undefined means exact */
  positionErrorMeters?: number;
  altitudeMeters?: number;
  speedKt?: number;
  headingDeg?: number;
  satsInView?: number;
  battery?: number;
  voltage?: number;
  channelUtil?: number;
  airUtilTx?: number;
  temperature?: number;
  relativeHumidity?: number;
  barometricPressure?: number;
  hops?: number;
  textMessage?: string;
  /** Channel the packet was heard on */
  channel: string;
  /** Node id of the gateway that uploaded it */
  gatewayId?: string;
  /** Mesh packet id; the same packet is often uploaded by several gateways */
  packetId?: number;
  lastPingTime: number;
}

export type DecodeResult =
  | { ok: true; update: BridgeNodeUpdate }
  | { ok: false; reason: string };

function updateFromData(base: BridgeNodeUpdate, data: DataMsg): BridgeNodeUpdate | null {
  const payload = data.payload;
  if (!payload) return null;
  switch (data.portnum) {
    case PortNum.POSITION_APP: {
      const pos = decodePosition(payload);
      const ll = positionLatLng(pos);
      if (!ll) return null;
      return {
        ...base,
        lat: ll.lat,
        lng: ll.lng,
        positionErrorMeters: positionErrorMeters(pos.precisionBits),
        altitudeMeters: pos.altitude,
        speedKt: positionSpeedKt(pos),
        headingDeg: positionTrackDeg(pos),
        satsInView: pos.satsInView,
      };
    }
    case PortNum.NODEINFO_APP: {
      const user = decodeUser(payload);
      return {
        ...base,
        longName: user.longName || undefined,
        shortName: user.shortName || undefined,
        hardwareModel: hardwareModelName(user.hwModel),
      };
    }
    case PortNum.TELEMETRY_APP: {
      const t = decodeTelemetry(payload);
      const dm = t.deviceMetrics;
      const env = t.environmentMetrics;
      if (!dm && !env) return null;
      return {
        ...base,
        battery: dm?.batteryLevel,
        voltage: dm?.voltage !== undefined ? +dm.voltage.toFixed(2) : undefined,
        channelUtil: dm?.channelUtilization !== undefined ? +dm.channelUtilization.toFixed(1) : undefined,
        airUtilTx: dm?.airUtilTx !== undefined ? +dm.airUtilTx.toFixed(1) : undefined,
        temperature: env?.temperature !== undefined ? +env.temperature.toFixed(1) : undefined,
        relativeHumidity: env?.relativeHumidity !== undefined ? +env.relativeHumidity.toFixed(1) : undefined,
        barometricPressure: env?.barometricPressure !== undefined ? +env.barometricPressure.toFixed(1) : undefined,
      };
    }
    case PortNum.TEXT_MESSAGE_APP:
      return { ...base, textMessage: Buffer.from(payload).toString('utf8') };
    default:
      return null;
  }
}

/**
 * Decodes one protobuf ServiceEnvelope. `channels` are the keys this room knows; a packet is
 * only decrypted with the key whose channel name matches the envelope and whose hash matches.
 */
export function decodeEnvelope(
  bytes: Uint8Array,
  channels: ChannelKey[],
  now = Date.now(),
  opts: { requireEncryption?: Set<string> } = {}
): DecodeResult {
  let env;
  try {
    env = decodeServiceEnvelope(bytes);
  } catch {
    return { ok: false, reason: 'not a ServiceEnvelope' };
  }
  const p = env.packet;
  if (!p || p.from === undefined) return { ok: false, reason: 'no packet' };
  if (env.channelId === 'PKI') return { ok: false, reason: 'direct (PKI) message' };

  const channelName = env.channelId || '';
  const base: BridgeNodeUpdate = {
    id: canonicalNodeId(p.from),
    channel: channelName,
    gatewayId: env.gatewayId ? canonicalNodeId(env.gatewayId) : undefined,
    packetId: p.id,
    hops: hopsTaken(p.hopStart, p.hopLimit),
    lastPingTime: now,
  };

  let data = p.decoded;
  // A channel with its own key only trusts packets encrypted with that key; anyone can publish
  // an unencrypted envelope with any node's id
  if (data && opts.requireEncryption?.has(channelName)) return { ok: false, reason: 'unencrypted packet on a private channel' };
  if (!data && p.encrypted && p.encryptedPayload) {
    const ch = channels.find((c) => c.name === channelName && (p.channel === undefined || channelHash(c.name, c.key) === p.channel));
    if (!ch) return { ok: false, reason: `no key for channel ${channelName || '?'}` };
    if (!ch.key) return { ok: false, reason: 'channel has no key but packet is encrypted' };
    if (p.id === undefined) return { ok: false, reason: 'encrypted packet without id' };
    try {
      data = decodeData(decryptPayload(p.encryptedPayload, ch.key, p.from, p.id));
    } catch {
      return { ok: false, reason: 'could not decrypt' };
    }
    if (data.portnum === undefined) return { ok: false, reason: 'could not decrypt' };
  }
  if (!data) return { ok: false, reason: 'empty packet' };

  const update = updateFromData(base, data);
  return update ? { ok: true, update } : { ok: false, reason: `port ${data.portnum ?? '?'} not used` };
}

/** Decodes one message from a .../2/json/... topic (firmware MeshPacketSerializer format) */
export function decodeJsonMessage(text: string, channelName: string, now = Date.now()): DecodeResult {
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'not JSON' };
  }
  if (typeof json?.from !== 'number') return { ok: false, reason: 'no sender' };
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
  const p = json.payload || {};
  const base: BridgeNodeUpdate = {
    id: canonicalNodeId(json.from),
    channel: channelName,
    gatewayId: typeof json.sender === 'string' ? canonicalNodeId(json.sender) : undefined,
    packetId: num(json.id),
    hops: num(json.hops_away),
    lastPingTime: now,
  };
  switch (json.type) {
    case 'position': {
      const latI = num(p.latitude_i);
      const lngI = num(p.longitude_i);
      if (latI === undefined || lngI === undefined || (latI === 0 && lngI === 0)) return { ok: false, reason: 'no position' };
      return {
        ok: true,
        update: {
          ...base,
          lat: latI / 1e7,
          lng: lngI / 1e7,
          positionErrorMeters: positionErrorMeters(num(p.precision_bits)),
          altitudeMeters: num(p.altitude),
          // Raw firmware units: km/h and degrees x 1e5
          speedKt: num(p.ground_speed) !== undefined ? +(p.ground_speed * KMH_TO_KT).toFixed(1) : undefined,
          headingDeg: num(p.ground_track) !== undefined ? Math.round(p.ground_track / 1e5) % 360 : undefined,
          satsInView: num(p.sats_in_view),
        },
      };
    }
    case 'nodeinfo':
      return { ok: true, update: { ...base, longName: p.longname || undefined, shortName: p.shortname || undefined } };
    case 'telemetry':
      return {
        ok: true,
        update: {
          ...base,
          battery: num(p.battery_level),
          voltage: num(p.voltage),
          channelUtil: num(p.channel_utilization),
          airUtilTx: num(p.air_util_tx),
          temperature: num(p.temperature),
          relativeHumidity: num(p.relative_humidity),
          barometricPressure: num(p.barometric_pressure),
        },
      };
    case 'text':
      return { ok: true, update: { ...base, textMessage: typeof p.text === 'string' ? p.text : undefined } };
    default:
      return { ok: false, reason: `type ${json.type ?? '?'} not used` };
  }
}

/** Splits msh/<region...>/2/<e|json>/<channel>/<gateway> */
export function parseMeshTopic(topic: string): { format: 'e' | 'json'; channel: string } | null {
  const parts = topic.split('/');
  const i = parts.lastIndexOf('2');
  if (i < 0 || i + 2 >= parts.length) return null;
  const format = parts[i + 1];
  if (format !== 'e' && format !== 'json' && format !== 'c') return null;
  return { format: format === 'json' ? 'json' : 'e', channel: parts[i + 2] };
}

export { BROADCAST_NUM };
