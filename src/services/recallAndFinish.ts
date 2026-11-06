// Individual recall (X flag, RRS 29.1) and recording finishes by hand.
import { Boat, BoatStatus, ClassRaceStatus, CourseMark } from '../types/regatta';
import { isFinishMark, isSequentialCourseMark, isStartMark } from './courseService';

/** RRS 29.1: X comes down once every recalled boat has returned, and no later than 4 minutes after the start */
export const X_FLAG_MAX_MS = 4 * 60 * 1000;

type LatLng = { lat: number; lng: number };

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Metres east/north of `origin`, accurate enough over a start area */
function toLocal(p: LatLng, origin: LatLng): { x: number; y: number } {
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos((origin.lat * Math.PI) / 180);
  return { x: (p.lng - origin.lng) * mPerDegLng, y: (p.lat - origin.lat) * mPerDegLat };
}

/**
 * Which side of the start line a position is on. The course side is the side the first mark is
 * on. Returns null without a full start line (pin and committee boat) or a first mark, or when
 * the position is on the line itself (within `toleranceM`).
 */
export function startLineSide(pos: LatLng, marks: CourseMark[], toleranceM = 2): 'COURSE' | 'PRE_START' | null {
  if (!pos || !isNum(pos.lat) || !isNum(pos.lng)) return null;
  const valid = (marks || []).filter((m) => m && isNum(m.lat) && isNum(m.lng));
  const pin = valid.find((m) => m.type === 'PIN_END');
  const rc = valid.find((m) => m.type === 'RC_BOAT');
  const first = valid
    .filter((m) => isSequentialCourseMark(m) && !isStartMark(m) && !isFinishMark(m))
    .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))[0];
  if (!pin || !rc || !first) return null;

  const a = toLocal(pin, pin);
  const b = toLocal(rc, pin);
  const lx = b.x - a.x;
  const ly = b.y - a.y;
  const len = Math.hypot(lx, ly);
  if (len < 1) return null;
  // Signed distance from the line: positive on the left of pin → committee boat
  const side = (p: LatLng) => {
    const q = toLocal(p, pin);
    return (lx * (q.y - a.y) - ly * (q.x - a.x)) / len;
  };
  const courseSign = Math.sign(side(first));
  if (courseSign === 0) return null;
  const d = side(pos) * courseSign;
  if (Math.abs(d) <= toleranceM) return null;
  return d > 0 ? 'COURSE' : 'PRE_START';
}

/**
 * Boats a position suggests are over the line: in the class, racing, with a fix taken within
 * `maxFixAgeMs` of now, on the course side. Only a suggestion: the race committee decides.
 */
export function ocsCandidates(
  boats: Boat[],
  marks: CourseMark[],
  className: string,
  fixTimeOf: (boat: Boat) => number | null,
  now: number,
  maxFixAgeMs = 30_000
): string[] {
  return boats
    .filter((b) => b.class === className && (b.status === 'RACING' || b.status === 'OCS'))
    .filter((b) => {
      const at = fixTimeOf(b);
      return at !== null && now - at <= maxFixAgeMs && startLineSide(b, marks) === 'COURSE';
    })
    .map((b) => b.id);
}

export interface XFlagState {
  /** X is up for this class */
  up: boolean;
  /** Time left before the 4-minute limit; 0 once it has passed */
  msLeft: number;
  /** Boats recalled under this X that are still OCS */
  stillOver: string[];
  /** Every recalled boat has returned, or the limit has passed: the flag should come down */
  shouldLower: boolean;
}

export function xFlagState(classState: ClassRaceStatus | undefined, boats: Boat[], now: number): XFlagState {
  const x = classState?.xFlag;
  if (!x || x.loweredAt) return { up: false, msLeft: 0, stillOver: [], shouldLower: false };
  const start = classState?.startTime ?? x.raisedAt;
  const msLeft = Math.max(0, start + X_FLAG_MAX_MS - now);
  const stillOver = x.boatIds.filter((id) => boats.find((b) => b.id === id)?.status === 'OCS');
  return { up: true, msLeft, stillOver, shouldLower: msLeft === 0 || stillOver.length === 0 };
}

/** Whether X can still be raised for this class: racing, within 4 minutes of its start, not raised yet */
export function canRaiseXFlag(classState: ClassRaceStatus | undefined, now: number): boolean {
  if (!classState || classState.status !== 'RACING' || !isNum(classState.startTime)) return false;
  if (classState.xFlag) return false;
  return now - classState.startTime < X_FLAG_MAX_MS;
}

/** Statuses that can be given a finish */
export function canRecordFinish(b: Boat): boolean {
  return (b.status === 'RACING' || b.status === 'CLEARED_OCS' || b.status === 'OCS') && !isNum(b.finishTime);
}

/**
 * A finish taken at `at` for a boat whose class started at `startTime`. A boat still OCS keeps
 * that status (it didn't start correctly, RRS A5.1) but its time is kept.
 */
export function recordFinish(b: Boat, at: number, startTime: number | undefined): Boat {
  const elapsed = isNum(startTime) ? Math.max(0, (at - startTime) / 1000) : b.elapsedSeconds;
  const status: BoatStatus = b.status === 'OCS' ? 'OCS' : 'FINISHED';
  return {
    ...b,
    status,
    finishTime: at,
    statusBeforeFinish: b.status,
    elapsedSeconds: elapsed,
    correctedSeconds: elapsed * (b.handicapRating || 1),
  };
}

/** Takes back a finish recorded by mistake; the clock runs on from the class start */
export function undoFinish(b: Boat, now: number, startTime: number | undefined): Boat {
  const { finishTime: _f, statusBeforeFinish, ...rest } = b;
  const elapsed = isNum(startTime) ? Math.max(0, (now - startTime) / 1000) : b.elapsedSeconds;
  return {
    ...rest,
    status: statusBeforeFinish && statusBeforeFinish !== 'FINISHED' ? statusBeforeFinish : 'RACING',
    elapsedSeconds: elapsed,
    correctedSeconds: elapsed * (b.handicapRating || 1),
  };
}

/** Finished boats (including OCS boats given a time), in the order they crossed */
export function finishOrder(boats: Boat[]): Boat[] {
  return boats.filter((b) => isNum(b.finishTime)).sort((a, b) => (a.finishTime as number) - (b.finishTime as number));
}

/** "MAS 12, MAS 7" for a recall notice; sail number, else name */
export function sailList(boats: Boat[], ids: string[]): string {
  return ids
    .map((id) => boats.find((b) => b.id === id))
    .filter((b): b is Boat => !!b)
    .map((b) => b.sailNumber || b.name)
    .join(', ');
}
