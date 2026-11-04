import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTrackerFixApplier } from '../src/services/trackerFix';
import { INITIAL_RACE_STATE } from '../src/services/initialData';
import { Boat, CourseMark, RaceState } from '../src/types/regatta';

const racing: RaceState = {
  ...INITIAL_RACE_STATE,
  status: 'RACING',
  countdownSeconds: 0,
  activeClass: 'Class 1',
  classStates: { 'Class 1': { status: 'RACING', countdownSeconds: 0, startSequenceActive: false } },
};

const mark1 = (lat: number, lng: number): CourseMark => ({
  id: 'mark-1',
  orderIndex: 1,
  name: 'Mark 1',
  shortName: '1',
  type: 'WINDWARD',
  lat,
  lng,
  radiusMeters: 65,
  requiredRounding: 'PORT',
});

const finish: CourseMark = {
  id: 'finish',
  orderIndex: 999,
  name: 'Finish',
  shortName: 'F',
  type: 'FINISH',
  lat: 6.2,
  lng: 99.7,
  radiusMeters: 65,
  requiredRounding: 'LINE',
};

const boat = (): Boat => ({
  id: 'boat-1',
  name: 'Test Boat',
  sailNumber: 'MAS 1',
  class: 'Class 1',
  handicapSystem: 'IRC',
  handicapRating: 1,
  skipper: 'Test',
  nodeId: '!a1b2c3d4',
  lat: 6.34,
  lng: 99.84,
  sog: 5,
  cog: 0,
  vmg: 0,
  dtw: 0,
  heading: 0,
  status: 'RACING',
  markRoundings: [],
  elapsedSeconds: 600,
  correctedSeconds: 600,
  color: '#00D4FF',
  trail: [{ lat: 6.34, lng: 99.84 }],
});

test('a tracker update rounds the mark where it is now, not where it was at load', () => {
  let marks: CourseMark[] = [mark1(6.3, 99.8), finish];
  const apply = createTrackerFixApplier(() => racing, () => marks);

  // The race officer moves Mark 1 after the page has loaded
  marks = [mark1(6.35, 99.85), finish];

  const atOldSpot = apply([boat()], { trackerId: '!a1b2c3d4', lat: 6.3, lng: 99.8, speedKt: 5, headingDeg: 200 });
  assert.equal(atOldSpot.changed, true);
  assert.equal(atOldSpot.rounding, null, 'passing the old position must not round the mark');
  assert.equal(atOldSpot.boats[0].markRoundings.length, 0);

  const atNewSpot = apply([boat()], { trackerId: '!a1b2c3d4', lat: 6.35, lng: 99.85, speedKt: 5, headingDeg: 45 });
  assert.deepEqual(atNewSpot.rounding, { boatId: 'boat-1', isFinished: false });
  assert.deepEqual(atNewSpot.boats[0].markRoundings.map((r) => r.markId), ['mark-1']);
});

test('a tracker update uses the current race state', () => {
  let raceState: RaceState = { ...racing, classStates: { 'Class 1': { status: 'RACING', countdownSeconds: 0, startSequenceActive: false } } };
  const apply = createTrackerFixApplier(() => raceState, () => []);

  raceState = { ...raceState, classStates: { 'Class 1': { status: 'FINISHED', countdownSeconds: 0, startSequenceActive: false } } };

  const res = apply([boat()], { trackerId: '!a1b2c3d4', lat: 6.341, lng: 99.841 });
  assert.equal(res.boats[0].status, 'DNF', 'a boat still racing when its class finishes is DNF');
});

test('0 kt from a tracker is a real reading; a missing reading keeps the last value', () => {
  const apply = createTrackerFixApplier(() => racing, () => []);
  const stopped = apply([boat()], { trackerId: '!a1b2c3d4', lat: 6.341, lng: 99.841, speedKt: 0 });
  assert.equal(stopped.boats[0].sog, 0);

  const noSpeed = apply([boat()], { trackerId: '!a1b2c3d4', lat: 6.341, lng: 99.841 });
  assert.equal(noSpeed.boats[0].sog, 5);
});

test('tracker ids match whatever case or prefix the boat stored', () => {
  const apply = createTrackerFixApplier(() => racing, () => []);
  const legacy = { ...boat(), nodeId: '!A1B2C3D4' };
  const res = apply([legacy], { trackerId: '!a1b2c3d4', lat: 6.341, lng: 99.841 });
  assert.equal(res.changed, true);
});
