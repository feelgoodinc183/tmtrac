import { ClassRaceStatus, RaceState } from '../types/regatta';
import { serverNow } from './serverClock';

export function getClassRaceState(raceState: RaceState, className: string): ClassRaceStatus {
  let baseState: ClassRaceStatus;
  if (raceState.classStates && raceState.classStates[className]) {
    baseState = raceState.classStates[className];
  } else if (raceState.activeClass === className) {
    baseState = {
      status: raceState.status,
      countdownSeconds: raceState.countdownSeconds,
      startSequenceActive: raceState.startSequenceActive,
      targetStartTime: raceState.targetStartTime,
      startTime: raceState.startTime,
      updatedAt: raceState.updatedAt,
    };
  } else {
    baseState = {
      status: 'PRE_START',
      countdownSeconds: 300,
      startSequenceActive: false,
    };
  }

  // If this class has an active sequence anchored to targetStartTime, calculate exact real-time seconds
  if (baseState.startSequenceActive && baseState.targetStartTime) {
    const msRemaining = baseState.targetStartTime - serverNow();
    const remainingSec = Math.max(0, Math.ceil(msRemaining / 1000));
    return {
      ...baseState,
      countdownSeconds: remainingSec,
      status: remainingSec <= 0 ? 'RACING' : 'COUNTDOWN',
    };
  }

  return baseState;
}
