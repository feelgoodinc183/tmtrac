// Room edits made offline: kept, merged with the server's state, and sent on reconnect.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEditSync, mergeList, mergeRaceState } from '../src/services/editSync';

const boat = (id: string, over: Record<string, unknown> = {}) => ({ id, name: id, sailNumber: `MAS ${id}`, status: 'RACING', lat: 6.3, lng: 99.8, nodeId: null, ...over }) as any;

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
}

test('mergeList: only this device changed a boat, so its version wins', () => {
  const base = [boat('a'), boat('b')];
  const ours = [boat('a', { status: 'FINISHED', finishTime: 5 }), boat('b')];
  const theirs = [boat('a'), boat('b', { lat: 7 })]; // b only moved: not an edit
  const r = mergeList('boats', base, ours, theirs);
  assert.equal(r.changed, true);
  assert.deepEqual(r.conflicts, []);
  assert.equal(r.merged.find((x) => x.id === 'a').status, 'FINISHED');
  assert.equal(r.merged.find((x) => x.id === 'b').lat, 7, 'the server\'s copy of an untouched boat is kept');
});

test('mergeList: both changed the same boat differently, so the server\'s is kept and reported', () => {
  const base = [boat('a')];
  const ours = [boat('a', { status: 'DNF' })];
  const theirs = [boat('a', { status: 'FINISHED' })];
  const r = mergeList('boats', base, ours, theirs);
  assert.deepEqual(r.conflicts, ['MAS a']);
  assert.equal(r.changed, false);
  assert.equal(r.merged[0].status, 'FINISHED');
});

test('mergeList: the same change on both sides is no conflict', () => {
  const r = mergeList('boats', [boat('a')], [boat('a', { status: 'OCS' })], [boat('a', { status: 'OCS' })]);
  assert.deepEqual([r.conflicts, r.changed], [[], false]);
});

test('mergeList: adds and deletes from both sides survive', () => {
  const base = [boat('a'), boat('b'), boat('c')];
  const ours = [boat('a'), boat('c'), boat('mine')]; // deleted b, added mine
  const theirs = [boat('a'), boat('b'), boat('c'), boat('theirs')]; // added theirs
  const r = mergeList('boats', base, ours, theirs);
  assert.deepEqual(r.merged.map((x) => x.id), ['a', 'c', 'theirs', 'mine']);
  assert.deepEqual(r.conflicts, []);
});

test('mergeList: both changed the same boat, different fields: both changes kept, no clash', () => {
  const base = [boat('a')];
  const ours = [boat('a', { status: 'FINISHED', finishTime: 9 })];
  const theirs = [boat('a', { name: 'Alpha Two', lat: 7 })];
  const r = mergeList('boats', base, ours, theirs);
  assert.deepEqual(r.conflicts, []);
  assert.equal(r.changed, true);
  assert.deepEqual([r.merged[0].name, r.merged[0].status, r.merged[0].finishTime, r.merged[0].lat], ['Alpha Two', 'FINISHED', 9, 7]);
});

test('mergeList: a clash on one field keeps the server\'s value there and ours elsewhere', () => {
  const r = mergeList('boats', [boat('a')], [boat('a', { status: 'DNF', name: 'Mine' })], [boat('a', { status: 'RET' })]);
  assert.deepEqual(r.conflicts, ['MAS a']);
  assert.deepEqual([r.merged[0].status, r.merged[0].name, r.changed], ['RET', 'Mine', true]);
});

test('pendingSession: the kept parts, for a page reloaded before the server answers', () => {
  const s = createEditSync({});
  s.setRoom('R1');
  assert.equal(s.pendingSession(), null);
  s.queue('boats', [boat('a')]);
  s.queue('classes', [{ id: 'c1', name: 'IRC 1' }]);
  assert.deepEqual(Object.keys(s.pendingSession()!).sort(), ['boats', 'raceClasses']);
});

test('mergeList: deleting a boat another device edited keeps their edit', () => {
  const r = mergeList('boats', [boat('a')], [], [boat('a', { name: 'Renamed' })]);
  assert.deepEqual(r.conflicts, ['MAS a']);
  assert.equal(r.merged[0].name, 'Renamed');
});

test('mergeRaceState: the later change wins', () => {
  const mine = mergeRaceState({ activeClass: 'Class 2', updatedAt: 200 }, { activeClass: 'Class 1', windSpeedKt: 12, updatedAt: 100 });
  assert.deepEqual([mine.merged.activeClass, mine.merged.windSpeedKt, mine.changed, mine.conflicts.length], ['Class 2', 12, true, 0]);
  const theirs = mergeRaceState({ activeClass: 'Class 2', updatedAt: 100 }, { activeClass: 'Class 3', updatedAt: 300 });
  assert.deepEqual([theirs.merged.activeClass, theirs.changed, theirs.conflicts], ['Class 3', false, ['Race settings']]);
});

test('queue, reconnect as Race Officer: merged and sent, then forgotten', () => {
  const s = createEditSync({ storage: memoryStorage() });
  s.setRoom('R1');
  s.noteServer('boats', [boat('a'), boat('b')]);
  s.queue('boats', [boat('a', { status: 'OCS' }), boat('b')]);
  s.queue('boats', [boat('a', { status: 'OCS' }), boat('b', { status: 'DNF' })]); // latest wins, base kept
  assert.equal(s.count(), 1);
  const r = s.reconcile({ boats: [boat('a'), boat('b'), boat('new')] }, true);
  assert.deepEqual(r.toSend.map((x) => x.channel), ['boats']);
  assert.deepEqual(r.session.boats.map((x: any) => `${x.id}:${x.status}`), ['a:OCS', 'b:DNF', 'new:RACING']);
  assert.equal(s.count(), 0);
});

test('reconnect without edit rights: changes shown but kept for later', () => {
  const s = createEditSync({ storage: memoryStorage() });
  s.setRoom('R1');
  s.noteServer('marks', [{ id: 'm1', name: 'Mark 1', lat: 1, lng: 1 }]);
  s.queue('marks', [{ id: 'm1', name: 'Mark 1', lat: 2, lng: 2 }]);
  const first = s.reconcile({ marks: [{ id: 'm1', name: 'Mark 1', lat: 1, lng: 1 }] }, false);
  assert.equal(first.session.marks[0].lat, 2, 'shown merged');
  assert.deepEqual([first.toSend, first.held], [[], true]);
  assert.equal(s.count(), 1);
  const second = s.reconcile({ marks: [{ id: 'm1', name: 'Mark 1', lat: 1, lng: 1 }] }, true);
  assert.deepEqual(second.toSend.map((x) => x.channel), ['marks']);
});

test('unsent changes survive a reload (stored per room)', () => {
  const storage = memoryStorage();
  const a = createEditSync({ storage });
  a.setRoom('R1');
  a.noteServer('classes', [{ id: 'c1', name: 'Class 1' }]);
  a.queue('classes', [{ id: 'c1', name: 'IRC 1' }]);
  a.queueNotice({ id: 'v1', title: 'X', content: 'y' } as any);
  const b = createEditSync({ storage });
  b.setRoom('R2');
  assert.equal(b.count(), 0, 'another room has none');
  b.setRoom('R1');
  assert.equal(b.count(), 2);
  const r = b.reconcile({ raceClasses: [{ id: 'c1', name: 'Class 1' }], vhfBulletins: [] }, true);
  assert.equal(r.session.raceClasses[0].name, 'IRC 1');
  assert.deepEqual(r.notices.map((n) => n.id), ['v1']);
  assert.equal(storage.m.size, 0, 'cleared once sent');
});

test('a notice the server already has is not sent twice', () => {
  const s = createEditSync({});
  s.setRoom('R1');
  s.queueNotice({ id: 'v1' } as any);
  assert.deepEqual(s.reconcile({ vhfBulletins: [{ id: 'v1' }] }, true).notices, []);
});

test('connection lost: changes sent after the last message from the server are kept to resend', () => {
  let t = 1000;
  const s = createEditSync({ now: () => t });
  s.setRoom('R1');
  s.noteServer('boats', [boat('a')]);
  s.noteSent('boats', [boat('a', { status: 'RET' })]); // t=1000
  t = 5000;
  s.noteSent('marks', [{ id: 'm1', name: 'M', lat: 1, lng: 1 }]); // t=5000
  s.noteNoticeSent({ id: 'v9' } as any);
  s.connectionLost(3000); // heard from the server at t=3000: boats arrived, marks and the notice may not have
  assert.equal(s.hasPending('boats'), false);
  assert.equal(s.hasPending('marks'), true);
  assert.equal(s.count(), 2);
  // It did arrive after all: the merge finds nothing to do and reports no conflict
  const r = s.reconcile({ marks: [{ id: 'm1', name: 'M', lat: 1, lng: 1 }], vhfBulletins: [{ id: 'v9' }] }, true);
  assert.deepEqual([r.toSend, r.conflicts, r.notices], [[], [], []]);
});

test('subscribers hear when the count changes', () => {
  const s = createEditSync({});
  s.setRoom('R1');
  let calls = 0;
  s.subscribe(() => calls++);
  s.queue('series', []);
  s.reconcile({ seriesRaces: [] }, true);
  assert.equal(calls, 2);
});
