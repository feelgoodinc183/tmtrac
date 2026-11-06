import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTrackerRelayGate } from '../src/services/trackerRelay';
import { Boat, MeshtasticNode } from '../src/types/regatta';

const node = (o: Partial<MeshtasticNode> = {}): MeshtasticNode => ({
  id: '!a1b2c3d4',
  longName: 'RM2',
  shortName: 'RM2',
  mac: '',
  boundBoatId: null,
  status: 'OPTIMAL',
  lastPingTime: Date.now(),
  lat: 6.31,
  lng: 99.82,
  speedKt: 0,
  ...o,
});

const boat = (id: string, nodeId: string | null): Boat => ({
  id, name: id, sailNumber: '', class: 'Class 1', handicapSystem: 'IRC', handicapRating: 1, skipper: '',
  nodeId, lat: 6.3, lng: 99.8, sog: 0, cog: 0, vmg: 0, dtw: 0, heading: 0, status: 'PRE_START',
  markRoundings: [], elapsedSeconds: 0, correctedSeconds: 0, color: '#0af', trail: [],
});

function clock() {
  let t = 1_000_000;
  return { now: () => t, advance: (ms: number) => { t += ms; } };
}

test('unbound trackers are not relayed or scored', () => {
  const gate = createTrackerRelayGate();
  assert.deepEqual(gate.decide(node(), [boat('b1', null)]), { boundBoatId: null, relay: false, applyFix: false });
  assert.deepEqual(gate.decide(node({ boundBoatId: 'someone-elses-boat' }), [boat('b1', null)]), { boundBoatId: null, relay: false, applyFix: false });
});

test('a tracker bound while sitting still is relayed on its next report', () => {
  const gate = createTrackerRelayGate();
  gate.decide(node(), []); // heard before it was bound
  const d = gate.decide(node(), [boat('b1', '!A1B2C3D4')]);
  assert.deepEqual(d, { boundBoatId: 'b1', relay: true, applyFix: true });
});

test('a stationary tracker is relayed at least every 60 s but scored once', () => {
  const c = clock();
  const gate = createTrackerRelayGate({ now: c.now });
  const boats = [boat('b1', '!a1b2c3d4')];
  assert.deepEqual(gate.decide(node(), boats), { boundBoatId: 'b1', relay: true, applyFix: true });
  c.advance(30_000);
  assert.deepEqual(gate.decide(node(), boats), { boundBoatId: 'b1', relay: false, applyFix: false });
  c.advance(30_000);
  assert.deepEqual(gate.decide(node(), boats), { boundBoatId: 'b1', relay: true, applyFix: false });
});

test('a change of speed at the same position is a new fix (a stopped boat shows 0 kt)', () => {
  const gate = createTrackerRelayGate();
  const boats = [boat('b1', '!a1b2c3d4')];
  gate.decide(node({ speedKt: 4.2 }), boats);
  assert.deepEqual(gate.decide(node({ speedKt: 0 }), boats), { boundBoatId: 'b1', relay: true, applyFix: true });
});

test('moving a tracker to another boat is relayed at once', () => {
  const gate = createTrackerRelayGate();
  gate.decide(node({ boundBoatId: 'b1' }), [boat('b1', '!a1b2c3d4'), boat('b2', null)]);
  const d = gate.decide(node({ boundBoatId: 'b2' }), [boat('b1', null), boat('b2', '!a1b2c3d4')]);
  assert.equal(d.boundBoatId, 'b2');
  assert.equal(d.relay, true);
});

test('a fix from the radio\'s NodeDB hours ago is not relayed or scored', () => {
  const c = clock();
  const gate = createTrackerRelayGate({ now: c.now });
  const boats = [boat('b1', '!a1b2c3d4')];
  const hoursAgo = c.now() - 13 * 60 * 60_000;
  assert.deepEqual(gate.decide(node({ positionTime: hoursAgo, lastPingTime: hoursAgo }), boats), { boundBoatId: null, relay: false, applyFix: false });
  // Heard just now (telemetry) but the position itself is old: still not shared
  assert.deepEqual(gate.decide(node({ positionTime: hoursAgo, lastPingTime: c.now() }), boats), { boundBoatId: null, relay: false, applyFix: false });
  // A position with no known time
  assert.deepEqual(gate.decide(node({ positionTime: 0 }), boats), { boundBoatId: null, relay: false, applyFix: false });
});

test('a fix within 15 min is relayed; the old fix rejected earlier still counts as new', () => {
  const c = clock();
  const gate = createTrackerRelayGate({ now: c.now });
  const boats = [boat('b1', '!a1b2c3d4')];
  gate.decide(node({ positionTime: c.now() - 60 * 60_000 }), boats);
  assert.deepEqual(gate.decide(node({ positionTime: c.now() - 14 * 60_000 }), boats), { boundBoatId: 'b1', relay: true, applyFix: true });
});

test('the node\'s binding wins over another boat still naming it (stale nodeId)', () => {
  const gate = createTrackerRelayGate();
  const d = gate.decide(node({ boundBoatId: 'b2' }), [boat('b1', '!a1b2c3d4'), boat('b2', '!a1b2c3d4')]);
  assert.equal(d.boundBoatId, 'b2');
});

test('forget() makes the next report count as new (used on bind, unbind and delete)', () => {
  const gate = createTrackerRelayGate();
  const boats = [boat('b1', '!a1b2c3d4')];
  gate.decide(node(), boats);
  gate.forget('!A1B2C3D4');
  assert.deepEqual(gate.decide(node(), boats), { boundBoatId: 'b1', relay: true, applyFix: true });
});
