import { Boat, BoatStatus, CourseMark, RaceState } from '../types/regatta';
import { getClassRaceState } from './classRaceState';
import { evaluateBoatCourseProgress } from './courseService';
import { sameNodeId } from '../utils/nodeId';

/**
 * Automatically computes live boat status with full RRS compliance:
 * - If race concludes or ends: unfinished racing boats become DNF, boats in pre-start become DNS.
 * - If boat crosses finish line: becomes FINISHED.
 * - Preserves existing final statuses (FINISHED, DSQ, RET, DNF, DNS).
 */
export function computeLiveBoatStatus(
  currentStatus: BoatStatus,
  progress: { isFinished: boolean; isOcs: boolean },
  classState: { status: string; countdownSeconds?: number; startSequenceActive?: boolean },
  elapsedSec?: number,
  roundingsCount?: number
): BoatStatus {
  // Preserve final locked outcomes
  if (
    currentStatus === 'FINISHED' ||
    currentStatus === 'DSQ' ||
    currentStatus === 'RET' ||
    currentStatus === 'DNF' ||
    currentStatus === 'DNS'
  ) {
    return currentStatus;
  }

  // If boat crossed finish line
  if (progress.isFinished) {
    return 'FINISHED';
  }

  // If race class has concluded/finished
  if (classState.status === 'FINISHED') {
    const hasStarted =
      (elapsedSec && elapsedSec > 0) ||
      (roundingsCount && roundingsCount > 0) ||
      currentStatus === 'RACING' ||
      currentStatus === 'OCS' ||
      currentStatus === 'CLEARED_OCS';
    return currentStatus === 'PRE_START' || !hasStarted ? 'DNS' : 'DNF';
  }

  // In Pre-start or countdown
  const isPreStartOrCountdown =
    classState.status === 'PRE_START' ||
    classState.status === 'COUNTDOWN' ||
    (typeof classState.countdownSeconds === 'number' && classState.countdownSeconds > 0);

  if (isPreStartOrCountdown) {
    return 'PRE_START';
  }

  if (currentStatus === 'CLEARED_OCS') {
    return 'CLEARED_OCS';
  }

  if (progress.isOcs) {
    return 'OCS';
  }

  if (currentStatus === 'OCS' && !progress.isOcs) {
    return 'RACING';
  }

  if (currentStatus === 'PRE_START' && classState.status === 'RACING') {
    return 'RACING';
  }

  return currentStatus;
}

/** One position report from a tracker (LoRa node, phone, or another fleet device). */
export interface TrackerFix {
  /** Id of the tracker the fix came from */
  trackerId: string;
  /** Boat the tracker is bound to, if known */
  boundBoatId?: string | null;
  lat: number;
  lng: number;
  /** Speed over ground in knots; 0 is a real reading. Leave undefined if the tracker didn't report it. */
  speedKt?: number;
  /** Course over ground in degrees; leave undefined if not reported. */
  headingDeg?: number;
}

export interface TrackerFixResult {
  boats: Boat[];
  /** True if any boat matched the fix */
  changed: boolean;
  /** Set when the fix rounded a mark or finished a boat */
  rounding: { boatId: string; isFinished: boolean } | null;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Builds the function that applies tracker fixes to the fleet.
 *
 * Race state and marks are read through getters on every fix, so a tracker update is always
 * scored against the current course and start sequence, not the ones from when the page loaded.
 */
export function createTrackerFixApplier(getRaceState: () => RaceState, getMarks: () => CourseMark[]) {
  return function applyTrackerFix(boats: Boat[], fix: TrackerFix): TrackerFixResult {
    if (!isNum(fix.lat) || !isNum(fix.lng) || (fix.lat === 0 && fix.lng === 0)) {
      return { boats, changed: false, rounding: null };
    }
    const raceState = getRaceState();
    const marks = getMarks();
    let changed = false;
    let rounding: TrackerFixResult['rounding'] = null;

    const updated = boats.map((b) => {
      // A known binding names exactly one boat; a stale nodeId on another boat must not move it too
      const matches = fix.boundBoatId ? b.id === fix.boundBoatId : sameNodeId(b.nodeId, fix.trackerId);
      if (!matches) return b;
      changed = true;

      const sog = isNum(fix.speedKt) ? fix.speedKt : b.sog;
      const cog = isNum(fix.headingDeg) ? fix.headingDeg : b.cog;
      const trail = [...(b.trail || []), { lat: fix.lat, lng: fix.lng }].slice(-1000);

      const classState = getClassRaceState(raceState, b.class);
      const tempBoat = { ...b, lat: fix.lat, lng: fix.lng, sog, cog, trail };
      const progress = evaluateBoatCourseProgress(tempBoat, marks, classState.countdownSeconds, b.lat, b.lng);
      const status = computeLiveBoatStatus(b.status, progress, classState, b.elapsedSeconds, b.markRoundings?.length);

      if (progress.newlyRounded && !rounding) {
        rounding = { boatId: b.id, isFinished: progress.isFinished };
      }

      return {
        ...b,
        nodeId: b.nodeId || fix.trackerId,
        lat: fix.lat,
        lng: fix.lng,
        sog,
        cog,
        heading: cog,
        trail,
        markRoundings: progress.updatedRoundings,
        dtw: progress.dtwNm,
        status,
      };
    });

    return { boats: changed ? updated : boats, changed, rounding };
  };
}
