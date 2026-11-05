// Server MQTT bridge lifecycle against a fake broker client.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCipheriv } from 'node:crypto';
import { create, toBinary } from '@bufbuild/protobuf';
import { Mesh, Mqtt, Portnums } from '@meshtastic/protobufs';
import {
  DEFAULT_ROOM_MQTT_CONFIG,
  MeshtasticMqttBridge,
  mergeRoomMqttConfig,
  toPublicConfig,
  allowedBrokerHosts,
  brokerUrlProblem,
  publicBrokerError,
  topicMatches,
  RoomMqttConfig,
} from '../src/server/mqttBridge';
import { channelHash, expandPsk } from '../src/server/meshtasticMqtt';

class FakeClient {
  handlers: Record<string, Function[]> = {};
  subs = new Set<string>();
  ended = false;
  constructor(public url: string, public opts: any) {}
  on(ev: string, cb: Function) { (this.handlers[ev] ||= []).push(cb); return this; }
  emit(ev: string, ...a: any[]) { (this.handlers[ev] || []).forEach((h) => h(...a)); }
  subscribe(t: string) { this.subs.add(t); }
  unsubscribe(t: string) { this.subs.delete(t); }
  end() { this.ended = true; }
}

function setup() {
  const clients: FakeClient[] = [];
  const updates: Array<[string, any]> = [];
  const statuses: Array<[string, any]> = [];
  const bridge = new MeshtasticMqttBridge({
    connect: (url, opts) => { const c = new FakeClient(url, opts); clients.push(c); return c as any; },
    onNodeUpdate: (room, u) => updates.push([room, u]),
    onStatus: (room, s) => statuses.push([room, s]),
    log: () => {},
    allowedHosts: new Set(['mqtt.meshtastic.org', 'broker.club.example']),
  });
  return { bridge, clients, updates, statuses };
}

const enabled: RoomMqttConfig = { ...DEFAULT_ROOM_MQTT_CONFIG, enabled: true };

function longFastPosition(id: number, from = 0xa1b2c3d4) {
  const key = expandPsk('AQ==')!;
  const data = toBinary(Mesh.DataSchema, create(Mesh.DataSchema, {
    portnum: Portnums.PortNum.POSITION_APP,
    payload: toBinary(Mesh.PositionSchema, create(Mesh.PositionSchema, { latitudeI: 63080000, longitudeI: 998200000, precisionBits: 13 })),
  }));
  const nonce = Buffer.alloc(16); nonce.writeUInt32LE(id, 0); nonce.writeUInt32LE(from, 8);
  const c = createCipheriv('aes-128-ctr', key, nonce);
  const enc = Buffer.concat([c.update(data), c.final()]);
  return Buffer.from(toBinary(Mqtt.ServiceEnvelopeSchema, create(Mqtt.ServiceEnvelopeSchema, {
    channelId: 'LongFast', gatewayId: '!0badcafe',
    packet: create(Mesh.MeshPacketSchema, { from, to: 0xffffffff, id, channel: channelHash('LongFast', key), payloadVariant: { case: 'encrypted', value: enc } }),
  })));
}

test('starts only when the room has MQTT on and someone has it open', () => {
  const { bridge, clients } = setup();
  bridge.setRoomConfig('RLYC', enabled);
  assert.equal(clients.length, 0, 'no viewers yet');
  assert.equal(bridge.getStatus('RLYC').state, 'waiting');

  bridge.setRoomActive('RLYC', true);
  assert.equal(clients.length, 1);
  assert.equal(clients[0].url, 'mqtts://mqtt.meshtastic.org:8883');
  assert.equal(clients[0].opts.username, 'meshdev');
  assert.equal(bridge.getStatus('RLYC').state, 'connecting');

  clients[0].emit('connect');
  assert.deepEqual([...clients[0].subs].sort(), ['msh/MY_919/2/e/LongFast/#', 'msh/MY_919/2/json/LongFast/#']);
  assert.equal(bridge.getStatus('RLYC').state, 'connected');

  bridge.setRoomActive('RLYC', false);
  assert.equal(clients[0].ended, true, 'last viewer left: disconnect');
});

test('status follows the broker: drop, reconnect, error', () => {
  const { bridge, clients, statuses } = setup();
  bridge.setRoomConfig('RLYC', enabled);
  bridge.setRoomActive('RLYC', true);
  const c = clients[0];
  c.emit('connect');
  c.emit('close');
  assert.equal(statuses.at(-1)![1].state, 'connecting');
  c.emit('error', new Error('getaddrinfo ENOTFOUND'));
  assert.equal(statuses.at(-1)![1].state, 'error');
  // Shown to everyone in the room, so it is generic
  assert.equal(statuses.at(-1)![1].error, 'Could not reach the broker.');
  c.subs.clear();
  c.emit('connect');
  assert.equal(statuses.at(-1)![1].state, 'connected');
  assert.equal(c.subs.size, 2, 'resubscribes after reconnect');
});

test('decodes, forwards to the room, and drops duplicates from other gateways', () => {
  const { bridge, clients, updates } = setup();
  bridge.setRoomConfig('RLYC', enabled);
  bridge.setRoomActive('RLYC', true);
  clients[0].emit('connect');
  const pkt = longFastPosition(77);
  clients[0].emit('message', 'msh/MY_919/2/e/LongFast/!0badcafe', pkt);
  clients[0].emit('message', 'msh/MY_919/2/e/LongFast/!11111111', pkt);
  clients[0].emit('message', 'msh/MY_919/2/e/LongFast/!0badcafe', longFastPosition(78));
  assert.equal(updates.length, 2);
  assert.equal(updates[0][0], 'RLYC');
  assert.equal(updates[0][1].id, '!a1b2c3d4');
  assert.ok(updates[0][1].positionErrorMeters > 1000);
  assert.equal(bridge.getStatus('RLYC').nodesHeard, 1);
});

test('rooms share one broker connection; topics are ref-counted', () => {
  const { bridge, clients, updates } = setup();
  bridge.setRoomConfig('A', enabled);
  bridge.setRoomConfig('B', { ...enabled, channels: [{ name: 'LongFast', psk: 'AQ==' }, { name: 'RLYC', psk: Buffer.alloc(32, 3).toString('base64') }] });
  bridge.setRoomActive('A', true);
  bridge.setRoomActive('B', true);
  assert.equal(clients.length, 1);
  clients[0].emit('connect');
  // LongFast: encrypted and JSON; RLYC has its own key, so encrypted only
  assert.equal(clients[0].subs.size, 3);

  clients[0].emit('message', 'msh/MY_919/2/e/LongFast/!0badcafe', longFastPosition(90));
  assert.deepEqual(updates.map((u) => u[0]).sort(), ['A', 'B']);

  bridge.setRoomActive('A', false);
  assert.equal(clients[0].ended, false);
  assert.equal(clients[0].subs.size, 3, 'B still needs LongFast');
  bridge.setRoomActive('B', false);
  assert.equal(clients[0].ended, true);
});

test('a custom broker gets its own connection and credentials', () => {
  const { bridge, clients } = setup();
  bridge.setRoomConfig('X', { ...enabled, brokerUrl: 'mqtts://broker.club.example:8883', username: 'club', password: 's3cret' });
  bridge.setRoomActive('X', true);
  assert.equal(clients[0].url, 'mqtts://broker.club.example:8883');
  assert.deepEqual([clients[0].opts.username, clients[0].opts.password], ['club', 's3cret']);

  // Changing config moves the room to the new broker and closes the old one
  bridge.setRoomConfig('X', enabled);
  assert.equal(clients[0].ended, true);
  assert.equal(clients[1].url, 'mqtts://mqtt.meshtastic.org:8883');
});

test('turning MQTT off stops it even with viewers', () => {
  const { bridge, clients } = setup();
  bridge.setRoomConfig('R', enabled);
  bridge.setRoomActive('R', true);
  bridge.setRoomConfig('R', { ...enabled, enabled: false });
  assert.equal(clients[0].ended, true);
  assert.equal(bridge.getStatus('R').state, 'off');
});

test('config merge: secrets kept unless replaced, never sent to browsers, input validated', () => {
  const custom = Buffer.alloc(32, 5).toString('base64');
  let c = mergeRoomMqttConfig(DEFAULT_ROOM_MQTT_CONFIG, {
    enabled: true, brokerUrl: 'mqtts://broker.club.example:8883', username: 'club', password: 'pw',
    channels: [{ name: 'LongFast', psk: 'AQ==' }, { name: 'RLYC', psk: custom }],
  }, { allowedHosts: new Set(['broker.club.example']) });
  // A later update that omits the key and password keeps them
  c = mergeRoomMqttConfig(c, { channels: [{ name: 'RLYC' }], username: 'club2' });
  assert.deepEqual(c.channels, [{ name: 'RLYC', psk: custom }]);
  assert.equal(c.password, 'pw');

  const pub = toPublicConfig(c);
  assert.equal(JSON.stringify(pub).includes(custom), false);
  assert.equal(JSON.stringify(pub).includes('pw"'), false);
  assert.deepEqual(pub.channels, [{ name: 'RLYC', keyKind: 'custom' }]);
  assert.equal(pub.hasPassword, true);

  assert.throws(() => mergeRoomMqttConfig(c, { brokerUrl: 'http://x' }), /must start with/);
  assert.throws(() => mergeRoomMqttConfig(c, { brokerUrl: 'mqtt://127.0.0.1:1883' }), /not an approved broker/);
  assert.throws(() => mergeRoomMqttConfig(c, { brokerUrl: 'mqtt://192.168.1.5' }), /not an approved broker/);
  assert.throws(() => mergeRoomMqttConfig(c, { rootTopic: 'foo/#' }), /Topic root/);
  assert.throws(() => mergeRoomMqttConfig(c, { channels: [{ name: 'New' }] }), /needs a key/);
  assert.throws(() => mergeRoomMqttConfig(c, { channels: [{ name: 'a/b', psk: 'AQ==' }] }), /not valid/);
  assert.throws(() => mergeRoomMqttConfig(c, { channels: [{ name: 'X', psk: 'not base64!' }] }), /base64/);
  assert.equal(mergeRoomMqttConfig(c, { brokerUrl: 'mqtt://127.0.0.1:1883' }, { allowAnyBroker: true }).brokerUrl, 'mqtt://127.0.0.1:1883');
  const allowed = new Set(['mqtt.meshtastic.org', 'other.example']);
  assert.equal(mergeRoomMqttConfig(c, { brokerUrl: 'mqtts://other.example:8883' }, { allowedHosts: allowed }).password, '', 'new broker drops old credentials');
});

test('topic filter matching', () => {
  assert.equal(topicMatches('msh/MY_919/2/e/LongFast/#', 'msh/MY_919/2/e/LongFast/!0badcafe'), true);
  assert.equal(topicMatches('msh/MY_919/2/e/LongFast/#', 'msh/MY_919/2/e/RLYC/!0badcafe'), false);
  assert.equal(topicMatches('msh/+/2/e/LongFast/#', 'msh/MY_919/2/e/LongFast/!x'), true);
});

test('custom brokers must be on the allow-list, so the server cannot be pointed at internal hosts', () => {
  const c = { ...DEFAULT_ROOM_MQTT_CONFIG };
  const allowedHosts = allowedBrokerHosts({ MQTT_ALLOWED_BROKER_HOSTS: 'broker.club.my, other.example' });
  // Every form that got past the old "private address" filter
  for (const url of [
    'mqtt://127.1:25',
    'mqtt://2130706433:22',
    'mqtt://0x7f000001:22',
    'mqtt://[::ffff:127.0.0.1]:6379',
    'mqtt://[::]:80',
    'mqtt://localtest.me:3306',
    'mqtt://169.254.169.254:1883',
    'mqtts://mqtt.meshtastic.org.evil.example:8883',
  ]) {
    assert.throws(() => mergeRoomMqttConfig(c, { brokerUrl: url }, { allowedHosts }), /not an approved broker|standard MQTT port/, url);
  }
  // Approved hosts, but only on MQTT ports
  assert.throws(() => mergeRoomMqttConfig(c, { brokerUrl: 'mqtt://broker.club.my:22' }, { allowedHosts }), /standard MQTT port/);
  assert.equal(mergeRoomMqttConfig(c, { brokerUrl: 'mqtts://broker.club.my:8883' }, { allowedHosts }).brokerUrl, 'mqtts://broker.club.my:8883');
  assert.equal(mergeRoomMqttConfig(c, { brokerUrl: 'wss://Broker.Club.MY/mqtt' }, { allowedHosts }).brokerUrl, 'wss://Broker.Club.MY/mqtt');
  // A password in the address would be shown to the room
  assert.throws(() => mergeRoomMqttConfig(c, { brokerUrl: 'mqtts://user:pw@broker.club.my:8883' }, { allowedHosts }), /own fields/);
  assert.equal(brokerUrlProblem('mqtts://mqtt.meshtastic.org:8883', { allowedHosts: allowedBrokerHosts({}) }), null);
});

test('a stored broker that is not allowed is refused at connect time too', () => {
  const clients: FakeClient[] = [];
  const statuses: Array<[string, any]> = [];
  const bridge = new MeshtasticMqttBridge({
    connect: (url, opts) => { const c = new FakeClient(url, opts); clients.push(c); return c as any; },
    onNodeUpdate: () => {},
    onStatus: (room, st) => statuses.push([room, st]),
    log: () => {},
    allowedHosts: new Set(['mqtt.meshtastic.org']),
  });
  bridge.setRoomConfig('R1', { ...enabled, brokerUrl: 'mqtt://127.1:1883' });
  bridge.setRoomActive('R1', true);
  assert.equal(clients.length, 0);
  assert.equal(bridge.getStatus('R1').state, 'error');
  assert.match(bridge.getStatus('R1').error!, /not an approved broker/);
});

test('connection errors shown to the room name no hosts or ports', () => {
  const e = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:3306'), { code: 'ECONNREFUSED' });
  assert.equal(publicBrokerError(e), 'Could not reach the broker.');
  assert.equal(publicBrokerError(new Error('Connection refused: Not authorized')), 'The broker refused the username or password.');
  const { bridge, clients } = setup();
  bridge.setRoomConfig('R1', enabled);
  bridge.setRoomActive('R1', true);
  clients[0].emit('error', e);
  assert.equal(bridge.getStatus('R1').error, 'Could not reach the broker.');
  assert.equal(JSON.stringify(bridge.getStatus('R1')).includes('127.0.0.1'), false);
  assert.equal('brokerUrl' in bridge.getStatus('R1'), false);
});

test('reconnects back off while the broker stays down, and reset once connected', () => {
  const { bridge, clients } = setup();
  bridge.setRoomConfig('R1', enabled);
  bridge.setRoomActive('R1', true);
  const client = clients[0] as any;
  client.options = { reconnectPeriod: 5000 };
  client.emit('close'); client.emit('close'); client.emit('close');
  assert.equal(client.options.reconnectPeriod, 40_000);
  for (let i = 0; i < 10; i++) client.emit('close');
  assert.equal(client.options.reconnectPeriod, 300_000);
  client.emit('connect');
  assert.equal(client.options.reconnectPeriod, 5000);
});

test('server-wide cap on broker connections', () => {
  const clients: FakeClient[] = [];
  const bridge = new MeshtasticMqttBridge({
    connect: (url, opts) => { const c = new FakeClient(url, opts); clients.push(c); return c as any; },
    onNodeUpdate: () => {},
    onStatus: () => {},
    log: () => {},
    maxConnections: 1,
    allowedHosts: new Set(['mqtt.meshtastic.org', 'b.example']),
  });
  bridge.setRoomConfig('R1', enabled);
  bridge.setRoomActive('R1', true);
  bridge.setRoomConfig('R2', { ...enabled, brokerUrl: 'mqtts://b.example:8883' });
  bridge.setRoomActive('R2', true);
  assert.equal(clients.length, 1);
  assert.match(bridge.getStatus('R2').error!, /limit of broker connections/);
});

test('oversized messages and floods are dropped', () => {
  const updates: any[] = [];
  const clients: FakeClient[] = [];
  let now = 1_000_000;
  const bridge = new MeshtasticMqttBridge({
    connect: (url, opts) => { const c = new FakeClient(url, opts); clients.push(c); return c as any; },
    onNodeUpdate: (_r, u) => updates.push(u),
    onStatus: () => {},
    log: () => {},
    now: () => now,
    maxUpdatesPerSecond: 3,
  });
  bridge.setRoomConfig('R1', enabled);
  bridge.setRoomActive('R1', true);
  const topic = 'msh/MY_919/2/e/LongFast/!0badcafe';
  clients[0].emit('message', topic, Buffer.alloc(5000));
  assert.equal(updates.length, 0);
  for (let i = 1; i <= 10; i++) clients[0].emit('message', topic, longFastPosition(i));
  assert.equal(updates.length, 3);
  now += 1000;
  clients[0].emit('message', topic, longFastPosition(99));
  assert.equal(updates.length, 4);
});

test('a channel with its own key takes only packets encrypted with that key', () => {
  const { bridge, clients, updates } = setup();
  const psk = Buffer.alloc(32, 7).toString('base64');
  bridge.setRoomConfig('R1', { ...enabled, channels: [{ name: 'RLYC', psk }] });
  bridge.setRoomActive('R1', true);
  // No JSON subscription for a private channel
  clients[0].emit('connect');
  assert.deepEqual([...clients[0].subs], ['msh/MY_919/2/e/RLYC/#']);
  // An unencrypted envelope claiming to be on the private channel is ignored
  const data = create(Mesh.DataSchema, {
    portnum: Portnums.PortNum.POSITION_APP,
    payload: toBinary(Mesh.PositionSchema, create(Mesh.PositionSchema, { latitudeI: 10, longitudeI: 10 })),
  });
  const forged = Buffer.from(toBinary(Mqtt.ServiceEnvelopeSchema, create(Mqtt.ServiceEnvelopeSchema, {
    channelId: 'RLYC', gatewayId: '!0badcafe',
    packet: create(Mesh.MeshPacketSchema, { from: 0x11111111, to: 0xffffffff, id: 5, payloadVariant: { case: 'decoded', value: data } }),
  })));
  clients[0].emit('message', 'msh/MY_919/2/e/RLYC/!0badcafe', forged);
  clients[0].emit('message', 'msh/MY_919/2/json/RLYC/!0badcafe', Buffer.from(JSON.stringify({ from: 0x11111111, type: 'position', payload: { latitude_i: 10, longitude_i: 10 } })));
  assert.equal(updates.length, 0);
});

test('public-channel chat is not forwarded into the race view', () => {
  const { bridge, clients, updates } = setup();
  bridge.setRoomConfig('R1', enabled);
  bridge.setRoomActive('R1', true);
  const key = expandPsk('AQ==')!;
  const data = toBinary(Mesh.DataSchema, create(Mesh.DataSchema, { portnum: Portnums.PortNum.TEXT_MESSAGE_APP, payload: Buffer.from('buy crypto') }));
  const nonce = Buffer.alloc(16); nonce.writeUInt32LE(77, 0); nonce.writeUInt32LE(0x22222222, 8);
  const ci = createCipheriv('aes-128-ctr', key, nonce);
  const enc = Buffer.concat([ci.update(data), ci.final()]);
  const env = Buffer.from(toBinary(Mqtt.ServiceEnvelopeSchema, create(Mqtt.ServiceEnvelopeSchema, {
    channelId: 'LongFast', gatewayId: '!0badcafe',
    packet: create(Mesh.MeshPacketSchema, { from: 0x22222222, to: 0xffffffff, id: 77, channel: channelHash('LongFast', key), payloadVariant: { case: 'encrypted', value: enc } }),
  })));
  clients[0].emit('message', 'msh/MY_919/2/e/LongFast/!0badcafe', env);
  assert.equal(updates.some(([, u]) => u.textMessage), false);
});

test('reloading a room with the same settings keeps the broker connection; removing it closes it', () => {
  const { bridge, clients } = setup();
  bridge.setRoomConfig('R1', enabled);
  bridge.setRoomActive('R1', true);
  bridge.setRoomConfig('R1', { ...enabled, channels: enabled.channels.map((c) => ({ ...c })) });
  assert.equal(clients.length, 1);
  assert.equal(clients[0].ended, false);
  bridge.removeRoom('R1');
  assert.equal(clients[0].ended, true);
  assert.equal(bridge.getStatus('R1').state, 'off');
});
