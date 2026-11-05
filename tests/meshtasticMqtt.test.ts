// Server-side MQTT decoding. Envelopes are built with the official definitions (@meshtastic/protobufs,
// dev dependency only) and encrypted the way the firmware does (CryptoEngine: AES-CTR, nonce =
// packet id LE64 | from LE32 | 0).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCipheriv } from 'node:crypto';
import { create, toBinary } from '@bufbuild/protobuf';
import { Mesh, Mqtt, Portnums, Telemetry } from '@meshtastic/protobufs';
import {
  DEFAULT_PSK,
  aesCtr,
  channelHash,
  decodeEnvelope,
  decodeJsonMessage,
  expandPsk,
  parseMeshTopic,
} from '../src/server/meshtasticMqtt';

const FROM = 0xa1b2c3d4;

function firmwareEncrypt(key: Buffer, from: number, id: number, plain: Uint8Array): Buffer {
  const nonce = Buffer.alloc(16);
  nonce.writeBigUInt64LE(BigInt(id), 0);
  nonce.writeUInt32LE(from, 8);
  const c = createCipheriv(key.length === 32 ? 'aes-256-ctr' : 'aes-128-ctr', key, nonce);
  return Buffer.concat([c.update(plain), c.final()]);
}

function envelope(opts: { channel: string; key: Buffer | null; portnum: number; payload: Uint8Array; id?: number; plain?: boolean }) {
  const id = opts.id ?? 0x5e1f00d1;
  const data = toBinary(Mesh.DataSchema, create(Mesh.DataSchema, { portnum: opts.portnum, payload: opts.payload }));
  const packet = create(Mesh.MeshPacketSchema, {
    from: FROM,
    to: 0xffffffff,
    id,
    channel: opts.plain ? 0 : channelHash(opts.channel, opts.key),
    hopStart: 3,
    hopLimit: 2,
    payloadVariant: opts.plain
      ? { case: 'decoded', value: create(Mesh.DataSchema, { portnum: opts.portnum, payload: opts.payload }) }
      : { case: 'encrypted', value: firmwareEncrypt(opts.key!, FROM, id, data) },
  });
  return toBinary(Mqtt.ServiceEnvelopeSchema, create(Mqtt.ServiceEnvelopeSchema, { packet, channelId: opts.channel, gatewayId: '!0badcafe' }));
}

const positionBytes = (o: Partial<{ latitudeI: number; longitudeI: number; precisionBits: number; groundSpeed: number; groundTrack: number }>) =>
  toBinary(Mesh.PositionSchema, create(Mesh.PositionSchema, { latitudeI: 63080000, longitudeI: 998200000, ...o }));

test('AES-CTR matches the RFC 3686 vectors the firmware tests against', () => {
  const k256 = Buffer.from('776BEFF2851DB06F4C8A0542C8696F6C6A81AF1EEC96B4D37FC1D689E6C1C104', 'hex');
  assert.equal(aesCtr(k256, Buffer.from('00000060DB5672C97AA8F0B200000001', 'hex'), Buffer.from('Single block msg')).toString('hex').toUpperCase(), '145AD01DBF824EC7560863DC71E3E0C0');
  const k128 = Buffer.from('AE6852F8121067CC4BF7A5765577F39E', 'hex');
  assert.equal(aesCtr(k128, Buffer.from('00000030000000000000000000000001', 'hex'), Buffer.from('Single block msg')).toString('hex').toUpperCase(), 'E4095D4FB7A7B3792D6175A3261311B8');
});

test('PSK expansion follows the firmware', () => {
  assert.deepEqual(expandPsk('AQ=='), DEFAULT_PSK);
  const k2 = expandPsk(Buffer.from([2]).toString('base64'))!;
  assert.equal(k2[15], DEFAULT_PSK[15] + 1);
  assert.equal(expandPsk('AA=='), null, 'index 0 = no encryption');
  assert.equal(expandPsk(''), null);
  const custom = Buffer.alloc(32, 7);
  assert.deepEqual(expandPsk(custom.toString('base64')), custom);
  assert.equal(expandPsk(Buffer.alloc(5, 1).toString('base64'))!.length, 16, 'short keys pad to AES-128');
});

test('public LongFast: decrypts with the default key and reports the position precision', () => {
  const key = expandPsk('AQ==')!;
  const bytes = envelope({ channel: 'LongFast', key, portnum: Portnums.PortNum.POSITION_APP, payload: positionBytes({ precisionBits: 13, groundSpeed: 0 }) });
  const r = decodeEnvelope(bytes, [{ name: 'LongFast', key }], 1_000);
  assert.equal(r.ok, true, (r as any).reason);
  const u = (r as any).update;
  assert.equal(u.id, '!a1b2c3d4');
  assert.equal(u.gatewayId, '!0badcafe');
  assert.equal(u.channel, 'LongFast');
  assert.equal(u.hops, 1);
  assert.equal(u.lat, 6.308);
  assert.equal(u.speedKt, 0);
  assert.equal(u.lastPingTime, 1_000);
  assert.ok(u.positionErrorMeters > 2000 && u.positionErrorMeters < 3500, `13 bits ≈ ±2.9 km, got ${u.positionErrorMeters}`);
});

test('club channel with its own 32-byte key: exact position, SOG and COG', () => {
  const key = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) key[i] = (i * 37 + 11) & 0xff;
  const bytes = envelope({ channel: 'RLYC', key, portnum: Portnums.PortNum.POSITION_APP, payload: positionBytes({ precisionBits: 32, groundSpeed: 13, groundTrack: 27_150_000 }) });
  const r = decodeEnvelope(bytes, [{ name: 'LongFast', key: expandPsk('AQ==') }, { name: 'RLYC', key }]);
  assert.equal(r.ok, true, (r as any).reason);
  const u = (r as any).update;
  assert.equal(u.positionErrorMeters, undefined);
  assert.equal(u.speedKt, 7);
  assert.equal(u.headingDeg, 272);
});

test('a packet for a channel the room has no key for is skipped, not misread', () => {
  const key = Buffer.alloc(16, 9);
  const bytes = envelope({ channel: 'Secret', key, portnum: Portnums.PortNum.POSITION_APP, payload: positionBytes({}) });
  const r = decodeEnvelope(bytes, [{ name: 'LongFast', key: expandPsk('AQ==') }]);
  assert.deepEqual(r, { ok: false, reason: 'no key for channel Secret' });

  const wrongKey = decodeEnvelope(bytes, [{ name: 'Secret', key: Buffer.alloc(16, 8) }]);
  assert.equal(wrongKey.ok, false, 'channel hash mismatch means wrong key');
});

test('telemetry and node info from encrypted packets', () => {
  const key = expandPsk('AQ==')!;
  const tel = decodeEnvelope(envelope({
    channel: 'LongFast', key, portnum: Portnums.PortNum.TELEMETRY_APP,
    payload: toBinary(Telemetry.TelemetrySchema, create(Telemetry.TelemetrySchema, { variant: { case: 'deviceMetrics', value: create(Telemetry.DeviceMetricsSchema, { batteryLevel: 101, voltage: 4.95 }) } })),
  }), [{ name: 'LongFast', key }]);
  assert.equal((tel as any).update.battery, 101);

  const ni = decodeEnvelope(envelope({
    channel: 'LongFast', key, portnum: Portnums.PortNum.NODEINFO_APP,
    payload: toBinary(Mesh.UserSchema, create(Mesh.UserSchema, { id: '!a1b2c3d4', longName: 'Sea Ghost', shortName: 'SG', hwModel: Mesh.HardwareModel.T_ECHO })),
  }), [{ name: 'LongFast', key }]);
  assert.deepEqual([(ni as any).update.longName, (ni as any).update.hardwareModel], ['Sea Ghost', 'LilyGO T-Echo']);
});

test('unencrypted envelopes are read directly', () => {
  const r = decodeEnvelope(envelope({ channel: 'Open', key: null, plain: true, portnum: Portnums.PortNum.POSITION_APP, payload: positionBytes({}) }), []);
  assert.equal(r.ok, true);
});

test('JSON topic messages use firmware units (km/h, degrees × 1e5)', () => {
  const r = decodeJsonMessage(JSON.stringify({ from: FROM, sender: '!0badcafe', type: 'position', payload: { latitude_i: 63080000, longitude_i: 998200000, ground_speed: 13, ground_track: 9_000_000, precision_bits: 32 } }), 'LongFast', 5);
  assert.equal(r.ok, true);
  const u = (r as any).update;
  assert.deepEqual([u.id, u.speedKt, u.headingDeg, u.positionErrorMeters], ['!a1b2c3d4', 7, 90, undefined]);
  assert.equal(decodeJsonMessage('{', 'x').ok, false);
});

test('topic parsing', () => {
  assert.deepEqual(parseMeshTopic('msh/MY_919/2/e/LongFast/!0badcafe'), { format: 'e', channel: 'LongFast' });
  assert.deepEqual(parseMeshTopic('msh/MY_919/2/json/RLYC/!0badcafe'), { format: 'json', channel: 'RLYC' });
  assert.equal(parseMeshTopic('msh/MY_919/2/stat/!0badcafe'), null);
});
