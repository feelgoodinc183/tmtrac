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
  assert.equal(statuses.at(-1)![1].error, 'getaddrinfo ENOTFOUND');
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
  assert.equal(clients[0].subs.size, 4);

  clients[0].emit('message', 'msh/MY_919/2/e/LongFast/!0badcafe', longFastPosition(90));
  assert.deepEqual(updates.map((u) => u[0]).sort(), ['A', 'B']);

  bridge.setRoomActive('A', false);
  assert.equal(clients[0].ended, false);
  assert.equal(clients[0].subs.size, 4, 'B still needs LongFast');
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
  });
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
  assert.throws(() => mergeRoomMqttConfig(c, { brokerUrl: 'mqtt://127.0.0.1:1883' }), /public internet host/);
  assert.throws(() => mergeRoomMqttConfig(c, { brokerUrl: 'mqtt://192.168.1.5' }), /public internet host/);
  assert.throws(() => mergeRoomMqttConfig(c, { rootTopic: 'foo/#' }), /Topic root/);
  assert.throws(() => mergeRoomMqttConfig(c, { channels: [{ name: 'New' }] }), /needs a key/);
  assert.throws(() => mergeRoomMqttConfig(c, { channels: [{ name: 'a/b', psk: 'AQ==' }] }), /not valid/);
  assert.throws(() => mergeRoomMqttConfig(c, { channels: [{ name: 'X', psk: 'not base64!' }] }), /base64/);
  assert.equal(mergeRoomMqttConfig(c, { brokerUrl: 'mqtt://127.0.0.1:1883' }, { allowPrivateBrokers: true }).brokerUrl, 'mqtt://127.0.0.1:1883');
  assert.equal(mergeRoomMqttConfig(c, { brokerUrl: 'mqtts://other.example:8883' }).password, '', 'new broker drops old credentials');
});

test('topic filter matching', () => {
  assert.equal(topicMatches('msh/MY_919/2/e/LongFast/#', 'msh/MY_919/2/e/LongFast/!0badcafe'), true);
  assert.equal(topicMatches('msh/MY_919/2/e/LongFast/#', 'msh/MY_919/2/e/RLYC/!0badcafe'), false);
  assert.equal(topicMatches('msh/+/2/e/LongFast/#', 'msh/MY_919/2/e/LongFast/!x'), true);
});
