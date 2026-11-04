/**
 * Server-side Meshtastic MQTT bridge.
 *
 * Browsers can't open raw MQTT (TCP 1883/8883), and channel keys and broker passwords shouldn't
 * live in the browser, so the server holds one connection per broker and forwards decoded node
 * updates to each room over the existing WebSocket.
 *
 * A room's subscriptions only run while the room has MQTT turned on AND someone has it open.
 * On shared hosting the app process can be stopped when idle; nothing is lost, because the
 * bridge starts again when the next viewer connects.
 */
import { BridgeNodeUpdate, ChannelKey, decodeEnvelope, decodeJsonMessage, expandPsk, parseMeshTopic } from './meshtasticMqtt';

export const DEFAULT_BROKER_URL = process.env.MESHTASTIC_MQTT_URL || 'mqtts://mqtt.meshtastic.org:8883';
export const DEFAULT_BROKER_USERNAME = process.env.MESHTASTIC_MQTT_USERNAME || 'meshdev';
export const DEFAULT_BROKER_PASSWORD = process.env.MESHTASTIC_MQTT_PASSWORD || 'large4cats';

export interface RoomMqttChannel {
  name: string;
  /** Base64 PSK as shown in the Meshtastic apps ("AQ==" is the public default). Secret. */
  psk: string;
}

/** Stored on the server only. Passwords and channel keys never go back to browsers. */
export interface RoomMqttConfig {
  enabled: boolean;
  /** Empty = the public Meshtastic broker */
  brokerUrl: string;
  username: string;
  password: string;
  /** Topic root, e.g. "msh/MY_919" */
  rootTopic: string;
  channels: RoomMqttChannel[];
}

export const DEFAULT_ROOM_MQTT_CONFIG: RoomMqttConfig = {
  enabled: false,
  brokerUrl: '',
  username: '',
  password: '',
  rootTopic: 'msh/MY_919',
  channels: [{ name: 'LongFast', psk: 'AQ==' }],
};

export type ChannelKeyKind = 'public' | 'custom' | 'none';

/** What browsers are allowed to see */
export interface PublicRoomMqttConfig {
  enabled: boolean;
  brokerUrl: string;
  usesPublicBroker: boolean;
  username: string;
  hasPassword: boolean;
  rootTopic: string;
  channels: Array<{ name: string; keyKind: ChannelKeyKind }>;
}

export interface BridgeStatus {
  state: 'off' | 'waiting' | 'connecting' | 'connected' | 'error';
  brokerUrl?: string;
  error?: string;
  /** When the last packet for this room was decoded */
  lastPacketAt?: number;
  /** Distinct nodes heard since the bridge started for this room */
  nodesHeard: number;
  topics: string[];
}

export function keyKind(psk: string): ChannelKeyKind {
  const raw = Buffer.from((psk || '').trim(), 'base64');
  if (raw.length === 0 || (raw.length === 1 && raw[0] === 0)) return 'none';
  if (raw.length === 1) return 'public';
  return 'custom';
}

export function toPublicConfig(c: RoomMqttConfig): PublicRoomMqttConfig {
  return {
    enabled: c.enabled,
    brokerUrl: c.brokerUrl,
    usesPublicBroker: !c.brokerUrl,
    username: c.username,
    hasPassword: !!c.password,
    rootTopic: c.rootTopic,
    channels: c.channels.map((ch) => ({ name: ch.name, keyKind: keyKind(ch.psk) })),
  };
}

const CHANNEL_NAME_RE = /^[A-Za-z0-9_-]{1,32}$/;
const ROOT_TOPIC_RE = /^msh(\/[A-Za-z0-9_-]{1,32}){0,4}$/;

function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (h === '::1' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80')) return h.includes(':');
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

/**
 * Merges an update from an admin into the stored config. Secrets that are left out (undefined)
 * keep their stored value. Throws with a user-facing message on invalid input.
 */
export function mergeRoomMqttConfig(
  current: RoomMqttConfig,
  input: any,
  opts: { allowPrivateBrokers?: boolean } = {}
): RoomMqttConfig {
  const next: RoomMqttConfig = { ...current, channels: current.channels.map((c) => ({ ...c })) };
  if (typeof input?.enabled === 'boolean') next.enabled = input.enabled;

  if (typeof input?.brokerUrl === 'string') {
    const url = input.brokerUrl.trim();
    if (url) {
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        throw new Error('Broker address must look like mqtts://host:8883 or wss://host/mqtt.');
      }
      if (!['mqtt:', 'mqtts:', 'ws:', 'wss:'].includes(parsed.protocol)) {
        throw new Error('Broker address must start with mqtt://, mqtts://, ws:// or wss://.');
      }
      if (!opts.allowPrivateBrokers && isPrivateHost(parsed.hostname)) {
        throw new Error('Broker address must be a public internet host.');
      }
    }
    if (url !== next.brokerUrl) {
      // A different broker gets different credentials
      next.username = '';
      next.password = '';
    }
    next.brokerUrl = url;
  }
  if (typeof input?.username === 'string') next.username = input.username.trim().slice(0, 128);
  if (typeof input?.password === 'string') next.password = input.password.slice(0, 256);

  if (typeof input?.rootTopic === 'string') {
    const root = input.rootTopic.trim().replace(/\/+$/, '');
    if (!ROOT_TOPIC_RE.test(root)) throw new Error('Topic root must look like msh/MY_919.');
    next.rootTopic = root;
  }

  if (Array.isArray(input?.channels)) {
    if (input.channels.length > 8) throw new Error('At most 8 channels.');
    next.channels = input.channels.map((c: any) => {
      const name = String(c?.name || '').trim();
      if (!CHANNEL_NAME_RE.test(name)) throw new Error(`Channel name "${name}" is not valid.`);
      const existing = current.channels.find((e) => e.name === name);
      let psk: string;
      if (typeof c?.psk === 'string') {
        psk = c.psk.trim();
        try {
          expandPsk(psk);
        } catch {
          throw new Error(`The key for channel ${name} is not a valid Meshtastic channel key.`);
        }
        if (psk && Buffer.from(psk, 'base64').toString('base64').replace(/=+$/, '') !== psk.replace(/=+$/, '')) {
          throw new Error(`The key for channel ${name} must be base64, as shown in the Meshtastic app.`);
        }
      } else if (existing) {
        psk = existing.psk;
      } else {
        throw new Error(`Channel ${name} needs a key.`);
      }
      return { name, psk };
    });
    const names = new Set(next.channels.map((c) => c.name));
    if (names.size !== next.channels.length) throw new Error('Channel names must be different.');
  }
  return next;
}

// ---------------------------------------------------------------------------

/** The parts of an mqtt.js client the bridge uses (so tests can pass a fake) */
export interface MqttClientLike {
  on(event: 'connect' | 'reconnect' | 'close' | 'offline', cb: () => void): unknown;
  on(event: 'error', cb: (err: Error) => void): unknown;
  on(event: 'message', cb: (topic: string, payload: Buffer) => void): unknown;
  subscribe(topic: string, opts: { qos: 0 }, cb?: (err?: Error | null) => void): unknown;
  unsubscribe(topic: string, cb?: (err?: Error) => void): unknown;
  end(force?: boolean): unknown;
}

export type MqttConnectFn = (url: string, opts: { username?: string; password?: string; clientId: string; reconnectPeriod: number; connectTimeout: number; clean: boolean }) => MqttClientLike;

export interface BridgeDeps {
  connect: MqttConnectFn;
  onNodeUpdate: (roomCode: string, update: BridgeNodeUpdate) => void;
  onStatus: (roomCode: string, status: BridgeStatus) => void;
  now?: () => number;
  log?: (msg: string) => void;
}

interface RoomState {
  config: RoomMqttConfig;
  active: boolean;
  connKey: string | null;
  topics: string[];
  keys: ChannelKey[];
  recentPackets: Map<string, number>;
  nodes: Set<string>;
  lastPacketAt?: number;
}

interface Connection {
  key: string;
  url: string;
  client: MqttClientLike;
  connected: boolean;
  error?: string;
  rooms: Set<string>;
  topicRefs: Map<string, number>;
}

export function topicMatches(filter: string, topic: string): boolean {
  const f = filter.split('/');
  const t = topic.split('/');
  for (let i = 0; i < f.length; i++) {
    if (f[i] === '#') return true;
    if (i >= t.length) return false;
    if (f[i] !== '+' && f[i] !== t[i]) return false;
  }
  return f.length === t.length;
}

const DEDUPE_WINDOW_MS = 60_000;

export class MeshtasticMqttBridge {
  private rooms = new Map<string, RoomState>();
  private conns = new Map<string, Connection>();
  private now: () => number;
  private log: (msg: string) => void;

  constructor(private deps: BridgeDeps) {
    this.now = deps.now || Date.now;
    this.log = deps.log || ((m) => console.log(`[MQTT bridge] ${m}`));
  }

  /** Sets a room's config (from storage or an admin update) and starts/stops it as needed */
  setRoomConfig(roomCode: string, config: RoomMqttConfig) {
    const room = this.room(roomCode);
    room.config = config;
    room.keys = config.channels.map((c) => ({ name: c.name, key: expandPsk(c.psk) }));
    this.reconcile(roomCode, true);
  }

  /** Whether anyone currently has the room open */
  setRoomActive(roomCode: string, active: boolean) {
    const room = this.room(roomCode);
    if (room.active === active) return;
    room.active = active;
    this.reconcile(roomCode, false);
  }

  getStatus(roomCode: string): BridgeStatus {
    const room = this.rooms.get(roomCode);
    if (!room || !room.config.enabled) return { state: 'off', nodesHeard: 0, topics: [] };
    const brokerUrl = room.config.brokerUrl || DEFAULT_BROKER_URL;
    if (!room.connKey) return { state: 'waiting', brokerUrl, nodesHeard: room.nodes.size, topics: room.topics };
    const conn = this.conns.get(room.connKey);
    return {
      state: conn?.connected ? 'connected' : conn?.error ? 'error' : 'connecting',
      brokerUrl,
      error: conn?.connected ? undefined : conn?.error,
      lastPacketAt: room.lastPacketAt,
      nodesHeard: room.nodes.size,
      topics: room.topics,
    };
  }

  shutdown() {
    for (const conn of this.conns.values()) {
      try {
        conn.client.end(true);
      } catch {}
    }
    this.conns.clear();
    for (const room of this.rooms.values()) room.connKey = null;
  }

  // -------------------------------------------------------------------------

  private room(code: string): RoomState {
    let r = this.rooms.get(code);
    if (!r) {
      r = { config: { ...DEFAULT_ROOM_MQTT_CONFIG }, active: false, connKey: null, topics: [], keys: [], recentPackets: new Map(), nodes: new Set() };
      this.rooms.set(code, r);
    }
    return r;
  }

  private brokerKey(c: RoomMqttConfig) {
    const url = c.brokerUrl || DEFAULT_BROKER_URL;
    const username = c.brokerUrl ? c.username : DEFAULT_BROKER_USERNAME;
    const password = c.brokerUrl ? c.password : DEFAULT_BROKER_PASSWORD;
    return { key: JSON.stringify([url, username, password]), url, username, password };
  }

  private desiredTopics(c: RoomMqttConfig): string[] {
    const topics = new Set<string>();
    for (const ch of c.channels) {
      topics.add(`${c.rootTopic}/2/e/${ch.name}/#`);
      topics.add(`${c.rootTopic}/2/json/${ch.name}/#`);
    }
    return [...topics];
  }

  private reconcile(roomCode: string, configChanged: boolean) {
    const room = this.room(roomCode);
    const want = room.config.enabled && room.active;
    const broker = this.brokerKey(room.config);
    const topics = this.desiredTopics(room.config);

    // Leave the current connection if we no longer want it, or the broker/topics changed
    if (room.connKey && (!want || room.connKey !== broker.key || configChanged)) {
      this.detach(roomCode, room);
    }
    if (want && !room.connKey) {
      if (configChanged) {
        room.nodes.clear();
        room.lastPacketAt = undefined;
      }
      this.attach(roomCode, room, broker, topics);
    }
    this.deps.onStatus(roomCode, this.getStatus(roomCode));
  }

  private attach(roomCode: string, room: RoomState, broker: { key: string; url: string; username: string; password: string }, topics: string[]) {
    let conn = this.conns.get(broker.key);
    if (!conn) {
      const client = this.deps.connect(broker.url, {
        username: broker.username || undefined,
        password: broker.password || undefined,
        clientId: `tmtrac_${Math.random().toString(16).slice(2, 10)}`,
        reconnectPeriod: 5000,
        connectTimeout: 15000,
        clean: true,
      });
      const c: Connection = { key: broker.key, url: broker.url, client, connected: false, rooms: new Set(), topicRefs: new Map() };
      conn = c;
      this.conns.set(broker.key, c);
      client.on('connect', () => {
        c.connected = true;
        c.error = undefined;
        this.log(`connected to ${c.url}`);
        // (Re)subscribe everything: a clean session forgets subscriptions on reconnect
        for (const t of c.topicRefs.keys()) client.subscribe(t, { qos: 0 });
        this.emitConnStatus(c);
      });
      client.on('reconnect', () => this.emitConnStatus(c));
      client.on('close', () => {
        if (!c.connected) return;
        c.connected = false;
        this.emitConnStatus(c);
      });
      client.on('error', (err: Error) => {
        c.error = err?.message || 'MQTT error';
        this.log(`error on ${c.url}: ${c.error}`);
        this.emitConnStatus(c);
      });
      client.on('message', (topic: string, payload: Buffer) => this.handleMessage(c, topic, payload));
    }
    conn.rooms.add(roomCode);
    for (const t of topics) {
      const refs = conn.topicRefs.get(t) || 0;
      conn.topicRefs.set(t, refs + 1);
      if (refs === 0 && conn.connected) conn.client.subscribe(t, { qos: 0 });
    }
    room.connKey = broker.key;
    room.topics = topics;
  }

  private detach(roomCode: string, room: RoomState) {
    const conn = room.connKey ? this.conns.get(room.connKey) : undefined;
    room.connKey = null;
    if (!conn) return;
    conn.rooms.delete(roomCode);
    for (const t of room.topics) {
      const refs = (conn.topicRefs.get(t) || 0) - 1;
      if (refs <= 0) {
        conn.topicRefs.delete(t);
        if (conn.connected) conn.client.unsubscribe(t);
      } else {
        conn.topicRefs.set(t, refs);
      }
    }
    room.topics = [];
    if (conn.rooms.size === 0) {
      this.log(`no rooms left on ${conn.url}; disconnecting`);
      try {
        conn.client.end(true);
      } catch {}
      this.conns.delete(conn.key);
    }
  }

  private emitConnStatus(conn: Connection) {
    for (const code of conn.rooms) this.deps.onStatus(code, this.getStatus(code));
  }

  private handleMessage(conn: Connection, topic: string, payload: Buffer) {
    const parsed = parseMeshTopic(topic);
    if (!parsed) return;
    const now = this.now();
    for (const code of conn.rooms) {
      const room = this.rooms.get(code);
      if (!room || !room.topics.some((f) => topicMatches(f, topic))) continue;
      const result = parsed.format === 'json'
        ? decodeJsonMessage(payload.toString('utf8'), parsed.channel, now)
        : decodeEnvelope(payload, room.keys, now);
      if (!result.ok) continue;
      const u = result.update;

      // The same packet usually arrives from several gateways; forward it once
      if (u.packetId !== undefined) {
        const dedupeKey = `${u.id}:${u.packetId}`;
        const seen = room.recentPackets.get(dedupeKey);
        if (seen !== undefined && now - seen < DEDUPE_WINDOW_MS) continue;
        room.recentPackets.set(dedupeKey, now);
        if (room.recentPackets.size > 5000) {
          for (const [k, t] of room.recentPackets) {
            if (now - t >= DEDUPE_WINDOW_MS) room.recentPackets.delete(k);
          }
        }
      }

      const firstPacket = room.lastPacketAt === undefined;
      const newNode = !room.nodes.has(u.id);
      room.nodes.add(u.id);
      room.lastPacketAt = now;
      this.deps.onNodeUpdate(code, u);
      if (firstPacket || newNode) this.deps.onStatus(code, this.getStatus(code));
    }
  }
}
