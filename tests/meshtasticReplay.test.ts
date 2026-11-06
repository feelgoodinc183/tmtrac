// Replays frames recorded from a real T-Echo (RM1, firmware 2.7.26) over USB with the meshtastic
// Python library: the want_config dump plus ten minutes of live mesh traffic. The fixture was
// cleaned for this public repo: config, channel and log frames are dropped, every position is moved
// by one fixed offset to the Langkawi test area, and nodes other than RM1/RM2 have made-up ids and names.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Boat, MeshtasticNode } from '../src/types/regatta';

const store: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
};

const { MeshtasticBleMqttService } = await import('../src/services/meshtasticBleMqttService');
const { decodeFromRadio } = await import('../src/services/meshtastic/protocol');
const { createTrackerRelayGate, isFixFresh, nodeFixTime } = await import('../src/services/trackerRelay');

const RM1 = '!dd69e9a8'; // the T-Echo on USB
const RM2 = '!a12264da'; // the other T-Echo, heard over LoRa

type Frame = { t: number; dir: 'from' | 'to'; kind: string; b64: string };
const frames: Frame[] = readFileSync(fileURLToPath(new URL('./fixtures/techo-rm1-usb.jsonl', import.meta.url)), 'utf8')
  .trim().split('\n').map((l) => JSON.parse(l));
const bytes = (f: Frame) => new Uint8Array(Buffer.from(f.b64, 'base64'));

function replay() {
  const svc = new MeshtasticBleMqttService();
  const nodes = new Map<string, MeshtasticNode>();
  svc.onNodeUpdate((n: MeshtasticNode | MeshtasticNode[]) => {
    for (const x of Array.isArray(n) ? n : [n]) nodes.set(x.id, x);
  });
  // The recording's config_complete_id answers the want_config_id the Python client sent
  const done = frames.find((f) => f.kind === 'config_complete_id')!;
  (svc as any).configId = decodeFromRadio(bytes(done)).configCompleteId;
  for (const f of frames) if (f.dir === 'from') svc.handleFromRadioBytes(bytes(f));
  return { svc, nodes };
}

const boat = (id: string, nodeId: string | null): Boat => ({
  id, name: id, sailNumber: '', class: 'Class 1', handicapSystem: 'IRC', handicapRating: 1, skipper: '',
  nodeId, lat: 6.3, lng: 99.8, sog: 0, cog: 0, vmg: 0, dtw: 0, heading: 0, status: 'PRE_START',
  markRoundings: [], elapsedSeconds: 0, correctedSeconds: 0, color: '#0af', trail: [],
});

test('fixture: a full config dump followed by live packets, and nothing private', () => {
  const kinds = new Set(frames.map((f) => f.kind));
  for (const k of ['my_info', 'metadata', 'node_info', 'config_complete_id', 'packet:TELEMETRY_APP']) {
    assert.ok(kinds.has(k), `fixture has ${k}`);
  }
  for (const k of ['config', 'moduleConfig', 'channel', 'log_record', 'mqttClientProxyMessage']) {
    assert.ok(!kinds.has(k), `fixture has no ${k} frames`);
  }
});

test('replay: the USB T-Echo is the connected node, with its model and firmware', () => {
  const { svc, nodes } = replay();
  assert.equal((svc as any).connectedNodeId, RM1);
  const rm1 = nodes.get(RM1)!;
  assert.equal(rm1.longName, 'RM1');
  assert.equal(rm1.connectionType, 'BLE');
  assert.equal(rm1.hops, 0);
  assert.match(rm1.hardwareModel || '', /T-Echo/);
  assert.match(rm1.firmwareVersion || '', /^2\.7\./);
});

test('replay: every node from the radio has a canonical id', () => {
  const { nodes } = replay();
  assert.ok(nodes.size >= 10, `got ${nodes.size} nodes`);
  for (const id of nodes.keys()) assert.match(id, /^![0-9a-f]{8}$/);
});

test('replay: RM2 is heard over LoRa, one hop away, with a position', () => {
  const { nodes } = replay();
  const rm2 = nodes.get(RM2)!;
  assert.equal(rm2.longName, 'RM2');
  assert.equal(rm2.connectionType, 'LORA_MESH');
  assert.equal(rm2.hops, 1);
  assert.deepEqual([rm2.lat, rm2.lng], [6.3, 99.8]);
});

test('replay: nodes the radio learned through an MQTT gateway are marked MQTT', () => {
  const { nodes } = replay();
  const viaMqtt = [...nodes.values()].filter((n) => n.connectionType === 'MQTT');
  assert.ok(viaMqtt.length > 0, 'the recording has viaMqtt NodeDB entries');
  assert.ok(!viaMqtt.some((n) => n.id === RM1 || n.id === RM2));
});

// The gate's clock set to just after RM2's fix, as if replayed live
const liveFor = (n: MeshtasticNode) => () => (n.positionTime as number) + 60_000;

test('replay: RM2\'s position carries the time of the fix, hours before the recording', () => {
  const { nodes } = replay();
  const rm2 = nodes.get(RM2)!;
  assert.ok(typeof rm2.positionTime === 'number' && rm2.positionTime > 1_700_000_000_000);
  assert.ok(Date.now() - rm2.positionTime! > 60 * 60_000, 'the NodeDB fix is over an hour old');
});

test('replay → relay gate: RM2\'s hours-old NodeDB fix is not relayed on connect (seen live on PR #24)', () => {
  const { nodes } = replay();
  const gate = createTrackerRelayGate();
  const boats = [boat('b1', RM2)];
  const relayed = [...nodes.values()].filter((n) => gate.decide(n, boats).relay).map((n) => n.id);
  assert.deepEqual(relayed, []);
});

test('replay: binding RM2 to a boat must not take its NodeDB fix (the check resolveTrackerPosition uses)', () => {
  const { nodes } = replay();
  const rm2 = nodes.get(RM2)!;
  assert.ok(Number.isFinite(rm2.lat), 'RM2 has a position in the NodeDB');
  assert.equal(isFixFresh(nodeFixTime(rm2)), false, 'but it is hours old, so the boat stays put');
  assert.equal(isFixFresh(nodeFixTime(rm2), rm2.positionTime! + 60_000), true, 'the same fix a minute after it was taken would be used');
});

test('replay → relay gate: only the bound tracker is relayed; strangers and unbound RM2 are not', () => {
  const { nodes } = replay();
  const all = [...nodes.values()];
  const now = liveFor(nodes.get(RM2)!);

  const unbound = createTrackerRelayGate({ now });
  for (const n of all) assert.equal(unbound.decide(n, [boat('b1', null)]).relay, false, `${n.id} not relayed with no binding`);

  const gate = createTrackerRelayGate({ now });
  const boats = [boat('b1', RM2.toUpperCase()), boat('b2', null)];
  const relayed = all.filter((n) => gate.decide(n, boats).relay).map((n) => n.id);
  assert.deepEqual(relayed, [RM2]);
});

test('replay → relay gate: binding a stranger with a position relays that stranger only', () => {
  const { nodes } = replay();
  const stranger = [...nodes.values()].find((n) => n.id !== RM1 && n.id !== RM2 && n.connectionType === 'LORA_MESH' && Number.isFinite(n.lat));
  assert.ok(stranger, 'a LoRa-heard stranger with a position');
  const gate = createTrackerRelayGate({ now: liveFor(stranger!) });
  const boats = [boat('b1', stranger!.id)];
  const relayed = [...nodes.values()].filter((n) => gate.decide(n, boats).relay).map((n) => n.id);
  assert.deepEqual(relayed, [stranger!.id]);
});
