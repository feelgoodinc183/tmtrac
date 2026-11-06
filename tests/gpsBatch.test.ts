// A batch of stored positions: trails in time order, and no pulling a boat back to an older fix.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyGpsBatch } from '../src/server/gpsBatch';

const boats = () => [{ id: 'b1', lat: 1, lng: 1, trail: [] as any[] }, { id: 'b2', lat: 1, lng: 1, trail: [] as any[] }];

test('points are sorted by time; the newest moves the tracker and its bound boat', () => {
  const r = applyGpsBatch({}, boats(), 'b1', { deviceId: 'x', points: [{ lat: 3, lng: 3, timestamp: 30 }, { lat: 2, lng: 2, timestamp: 20 }] }, 99);
  assert.equal(r.moved, true);
  assert.deepEqual([r.tracker.lat, r.tracker.fixTime, r.tracker.lastSeen, r.tracker.points], [3, 30, 99, undefined]);
  assert.deepEqual(r.tracker.trail, [{ lat: 2, lng: 2 }, { lat: 3, lng: 3 }]);
  assert.deepEqual([r.boats[0].lat, r.boats[1].lat], [3, 1]);
});

test('a batch older than the last fix keeps the position but adds to the trail', () => {
  const existing = { lat: 9, lng: 9, fixTime: 100, speedKt: 5, trail: [{ lat: 9, lng: 9 }] };
  const r = applyGpsBatch(existing, boats(), 'b1', { deviceId: 'x', points: [{ lat: 2, lng: 2, timestamp: 50, speedKt: 1 }] }, 200);
  assert.equal(r.moved, false);
  assert.deepEqual([r.tracker.lat, r.tracker.speedKt, r.tracker.fixTime], [9, 5, 100]);
  assert.equal(r.tracker.trail.length, 2);
  assert.equal(r.boats[0].lat, 1, 'boat stays');
  assert.equal(r.boats[0].trail.length, 1);
  assert.equal(r.boatChanged, true);
});

test('points without times still move (old clients); empty and zero points are ignored', () => {
  const r = applyGpsBatch({ fixTime: 100 }, boats(), 'b1', { deviceId: 'x', points: [{ lat: 0, lng: 0 }, { lat: 4, lng: 4 }] }, 1);
  assert.equal(r.moved, true);
  assert.equal(r.boats[0].lat, 4);
  const none = applyGpsBatch({}, boats(), 'b1', { deviceId: 'x', points: [{ lat: 0, lng: 0 }] }, 1);
  assert.deepEqual([none.moved, none.boatChanged], [false, false]);
});

test('without a bound boat the fleet is untouched', () => {
  const list = boats();
  const r = applyGpsBatch({}, list, null, { deviceId: 'x', points: [{ lat: 4, lng: 4, timestamp: 1 }] }, 1);
  assert.equal(r.boats, list);
  assert.equal(r.boatChanged, false);
});
