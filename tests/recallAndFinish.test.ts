// Individual recall (X flag) and recording finishes by hand.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  X_FLAG_MAX_MS, canRaiseXFlag, canRecordFinish, finishOrder, ocsCandidates, recordFinish, sailList,
  startLineSide, undoFinish, xFlagState,
} from '../src/services/recallAndFinish';
import { generateCoursePreset } from '../src/services/courseService';
import { Boat, ClassRaceStatus, CourseMark } from '../src/types/regatta';

// A made-up start area: line running east-west, first mark to the north
const pin: CourseMark = { id: 'pin', name: 'Pin', type: 'PIN_END', lat: 10, lng: 20, radiusMeters: 30, requiredRounding: 'LINE', orderIndex: 0 };
const rc: CourseMark = { id: 'rc', name: 'RC', type: 'RC_BOAT', lat: 10, lng: 20.002, radiusMeters: 30, requiredRounding: 'LINE', orderIndex: 0 };
const m1: CourseMark = { id: 'm1', name: 'Mark 1', type: 'WINDWARD', lat: 10.01, lng: 20.001, radiusMeters: 45, requiredRounding: 'PORT', orderIndex: 1 };
const marks = [pin, rc, m1];

const boat = (id: string, over: Partial<Boat> = {}): Boat => ({
  id, name: id, sailNumber: `MAS ${id}`, class: 'Class 1', handicapSystem: 'IRC', handicapRating: 1.1, skipper: '',
  nodeId: null, lat: 10, lng: 20.001, sog: 0, cog: 0, vmg: 0, dtw: 0, heading: 0, status: 'RACING',
  markRoundings: [], elapsedSeconds: 0, correctedSeconds: 0, color: '#fff', trail: [], ...over,
});

test('startLineSide: the course side is the side the first mark is on', () => {
  assert.equal(startLineSide({ lat: 10.0005, lng: 20.001 }, marks), 'COURSE');
  assert.equal(startLineSide({ lat: 9.9995, lng: 20.001 }, marks), 'PRE_START');
  assert.equal(startLineSide({ lat: 10.000005, lng: 20.001 }, marks), null, 'on the line');
  // The same line with the course to the south flips the answer
  const south = { ...m1, lat: 9.99 };
  assert.equal(startLineSide({ lat: 10.0005, lng: 20.001 }, [pin, rc, south]), 'PRE_START');
  // Not latitude: a north-south line with the first mark to the east
  const p2 = { ...pin, lat: 10, lng: 20 }, r2 = { ...rc, lat: 10.002, lng: 20 }, east = { ...m1, lat: 10.001, lng: 20.01 };
  assert.equal(startLineSide({ lat: 10.001, lng: 20.0005 }, [p2, r2, east]), 'COURSE');
  assert.equal(startLineSide({ lat: 10.001, lng: 19.9995 }, [p2, r2, east]), 'PRE_START');
});

test('startLineSide needs a whole start line and a first mark', () => {
  assert.equal(startLineSide({ lat: 10.0005, lng: 20.001 }, [pin, m1]), null);
  assert.equal(startLineSide({ lat: 10.0005, lng: 20.001 }, [pin, rc]), null);
  assert.equal(startLineSide({ lat: NaN, lng: 20 }, marks), null);
});

test('startLineSide works on the built-in Windward-Leeward course', () => {
  const wl = generateCoursePreset('WINDWARD_LEEWARD', 6.308, 99.845, 45);
  const m = wl.find((x) => x.type === 'WINDWARD')!;
  const p = wl.find((x) => x.type === 'PIN_END')!, r = wl.find((x) => x.type === 'RC_BOAT')!;
  const mid = { lat: (p.lat + r.lat) / 2, lng: (p.lng + r.lng) / 2 };
  const towards = (f: number) => ({ lat: mid.lat + (m.lat - mid.lat) * f, lng: mid.lng + (m.lng - mid.lng) * f });
  assert.equal(startLineSide(towards(0.05), wl), 'COURSE');
  assert.equal(startLineSide(towards(-0.05), wl), 'PRE_START');
});

test('ocsCandidates: racing boats of the class, over the line, with a fresh fix only', () => {
  const now = 1_000_000;
  const boats = [
    boat('1', { lat: 10.0005 }), // over, fresh
    boat('2', { lat: 9.9995 }), // behind
    boat('3', { lat: 10.0005 }), // over, stale fix
    boat('4', { lat: 10.0005, class: 'Class 2' }), // other class
    boat('5', { lat: 10.0005, status: 'FINISHED' }),
    boat('6', { lat: 10.0005 }), // no tracker
  ];
  const fix: Record<string, number> = { '1': now - 5_000, '2': now - 5_000, '3': now - 120_000, '4': now, '5': now };
  assert.deepEqual(ocsCandidates(boats, marks, 'Class 1', (b) => fix[b.id] ?? null, now), ['1']);
});

test('X flag: can go up only while racing, within 4 minutes of the start, once', () => {
  const start = 5_000_000;
  const cs = (o: Partial<ClassRaceStatus> = {}): ClassRaceStatus => ({ status: 'RACING', countdownSeconds: 0, startSequenceActive: false, startTime: start, ...o });
  assert.equal(canRaiseXFlag(cs(), start + 1000), true);
  assert.equal(canRaiseXFlag(cs(), start + X_FLAG_MAX_MS), false);
  assert.equal(canRaiseXFlag(cs({ status: 'COUNTDOWN' }), start), false);
  assert.equal(canRaiseXFlag(cs({ startTime: undefined }), start), false);
  assert.equal(canRaiseXFlag(cs({ xFlag: { raisedAt: start, boatIds: ['1'] } }), start + 1000), false);
  assert.equal(canRaiseXFlag(undefined, start), false);
});

test('X flag state: time left, boats still over, and when to lower it', () => {
  const start = 5_000_000;
  const cs: ClassRaceStatus = { status: 'RACING', countdownSeconds: 0, startSequenceActive: false, startTime: start, xFlag: { raisedAt: start + 10_000, boatIds: ['1', '2'] } };
  const boats = [boat('1', { status: 'OCS' }), boat('2', { status: 'OCS' })];
  let x = xFlagState(cs, boats, start + 60_000);
  assert.deepEqual([x.up, x.msLeft, x.stillOver, x.shouldLower], [true, X_FLAG_MAX_MS - 60_000, ['1', '2'], false]);
  boats[0] = { ...boats[0], status: 'CLEARED_OCS' };
  boats[1] = { ...boats[1], status: 'CLEARED_OCS' };
  x = xFlagState(cs, boats, start + 60_000);
  assert.deepEqual([x.stillOver, x.shouldLower], [[], true], 'all returned');
  x = xFlagState(cs, [boat('1', { status: 'OCS' })], start + X_FLAG_MAX_MS + 1);
  assert.deepEqual([x.msLeft, x.shouldLower], [0, true], 'time is up');
  assert.equal(xFlagState({ ...cs, xFlag: { ...cs.xFlag!, loweredAt: start + 70_000 } }, boats, start + 80_000).up, false);
  assert.equal(xFlagState(undefined, boats, start).up, false);
});

test('recordFinish: exact elapsed time from the class start; an OCS boat keeps OCS', () => {
  const start = 1_000_000;
  const f = recordFinish(boat('1', { elapsedSeconds: 3590 }), start + 3_600_500, start);
  assert.deepEqual([f.status, f.finishTime, f.elapsedSeconds, f.statusBeforeFinish], ['FINISHED', start + 3_600_500, 3600.5, 'RACING']);
  assert.ok(Math.abs(f.correctedSeconds - 3960.55) < 1e-6);
  const o = recordFinish(boat('2', { status: 'OCS' }), start + 1_000_000, start);
  assert.equal(o.status, 'OCS');
  assert.equal(o.finishTime, start + 1_000_000);
  // Without a known start the running clock is kept
  assert.equal(recordFinish(boat('3', { elapsedSeconds: 42 }), start, undefined).elapsedSeconds, 42);
});

test('undoFinish puts the status back and restarts the clock from the class start', () => {
  const start = 1_000_000;
  const f = recordFinish(boat('1', { status: 'CLEARED_OCS' }), start + 600_000, start);
  const u = undoFinish(f, start + 700_000, start);
  assert.equal(u.status, 'CLEARED_OCS');
  assert.equal(u.finishTime, undefined);
  assert.equal(u.statusBeforeFinish, undefined);
  assert.equal(u.elapsedSeconds, 700);
  assert.equal(canRecordFinish(u), true);
  assert.equal(canRecordFinish(f), false);
});

test('finishOrder and sailList', () => {
  const boats = [boat('a', { finishTime: 30 }), boat('b'), boat('c', { finishTime: 10, status: 'OCS' })];
  assert.deepEqual(finishOrder(boats).map((b) => b.id), ['c', 'a']);
  assert.equal(sailList(boats, ['c', 'zz', 'a']), 'MAS c, MAS a');
});
