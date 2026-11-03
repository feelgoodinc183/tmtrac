import { Boat, CourseMark, RaceState, RaceHighlightMoment } from '../types/regatta';

/**
 * Key replay moments built only from what was recorded: class starts, the first boat to
 * round each mark (from logged mark roundings), and the first finisher. With no recorded
 * race data this returns an empty list.
 */
export function generateRaceHighlights(
  boats: Boat[],
  raceState: RaceState,
  courseMarks: CourseMark[]
): RaceHighlightMoment[] {
  const highlights: RaceHighlightMoment[] = [];
  const fmt = (sec: number) =>
    `${Math.floor(sec / 60).toString().padStart(2, '0')}:${Math.floor(sec % 60).toString().padStart(2, '0')}`;

  // 1. Starts that actually happened
  const classStates = raceState.classStates || {};
  const startedClasses = Object.entries(classStates).filter(
    ([, cs]) => cs.startTime && (cs.status === 'RACING' || cs.status === 'FINISHED')
  );
  if (startedClasses.length === 0 && raceState.startTime && (raceState.status === 'RACING' || raceState.status === 'FINISHED')) {
    startedClasses.push([raceState.activeClass, { status: raceState.status, countdownSeconds: 0, startSequenceActive: false, startTime: raceState.startTime }]);
  }
  for (const [className] of startedClasses) {
    const classBoats = boats.filter((b) => b.class === className);
    highlights.push({
      id: `hl-start-${className}`,
      timeSec: 0,
      timestampSec: 0,
      title: `Start: ${className}`,
      subtitle: `${classBoats.length} ${classBoats.length === 1 ? 'boat' : 'boats'}`,
      description: `${className} started with ${classBoats.length} ${classBoats.length === 1 ? 'boat' : 'boats'} entered.`,
      type: 'START_GUN',
      icon: 'START',
      boatIds: classBoats.map((b) => b.id),
      badgeColor: 'bg-green-500/20 text-green-400 border-green-500/40',
    });
  }

  // 2. First valid rounding of each mark, from the logged roundings
  const firstRounding = new Map<string, { boat: Boat; markName: string; sec: number }>();
  for (const boat of boats) {
    for (const r of boat.markRoundings || []) {
      if (!r.isValid || typeof r.elapsedAtSec !== 'number') continue;
      const cur = firstRounding.get(r.markId);
      if (!cur || r.elapsedAtSec < cur.sec) firstRounding.set(r.markId, { boat, markName: r.markName, sec: r.elapsedAtSec });
    }
  }
  for (const [markId, { boat, markName, sec }] of firstRounding) {
    const mark = courseMarks.find((m) => m.id === markId);
    highlights.push({
      id: `hl-mark-${markId}`,
      timeSec: sec,
      timestampSec: sec,
      title: `First to round ${mark?.name || markName}`,
      subtitle: boat.name,
      description: `${boat.name}${boat.sailNumber ? ` (${boat.sailNumber})` : ''} rounded ${mark?.name || markName} first, at ${fmt(sec)}.`,
      type: 'MARK_ROUNDING',
      icon: 'MARK',
      markId,
      boatIds: [boat.id],
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    });
  }

  // 3. First finisher, from recorded elapsed time
  const finishers = boats
    .filter((b) => b.status === 'FINISHED' && typeof b.elapsedSeconds === 'number' && b.elapsedSeconds > 0)
    .sort((a, b) => a.elapsedSeconds - b.elapsedSeconds);
  if (finishers.length > 0) {
    const first = finishers[0];
    highlights.push({
      id: 'hl-first-finish',
      timeSec: first.elapsedSeconds,
      timestampSec: first.elapsedSeconds,
      title: `First finish: ${first.name}`,
      subtitle: first.sailNumber || '',
      description: `${first.name} finished first on the water at ${fmt(first.elapsedSeconds)} elapsed.`,
      type: 'FINISH_DUEL',
      icon: 'FINISH',
      boatIds: [first.id],
      badgeColor: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
    });
  }

  return highlights.sort((a, b) => a.timeSec - b.timeSec);
}

/** Length of the recorded race in seconds (0 when nothing has been recorded). */
export function recordedRaceDurationSec(boats: Boat[], raceState: RaceState): number {
  const fromBoats = Math.max(0, ...boats.map((b) => (typeof b.elapsedSeconds === 'number' ? b.elapsedSeconds : 0)));
  const fromRoundings = Math.max(
    0,
    ...boats.flatMap((b) => (b.markRoundings || []).map((r) => (typeof r.elapsedAtSec === 'number' ? r.elapsedAtSec : 0)))
  );
  return Math.ceil(Math.max(fromBoats, fromRoundings));
}

export function generateHighlightReportText(
  boats: Boat[],
  raceState: RaceState,
  highlights: RaceHighlightMoment[]
): string {
  const sorted = [...boats].sort((a, b) => (a.rank || 99) - (b.rank || 99));
  const winner = sorted[0];
  const runnerUp = sorted[1];
  const maxSpeed = Math.max(...boats.map((b) => b.speedKt ?? b.sog ?? 0), 0);
  const elapsed = Math.floor(raceState.elapsedSeconds ?? raceState.elapsedTimeSeconds ?? recordedRaceDurationSec(boats, raceState));

  return `🏆 REGATTA RACE REPLAY HIGHLIGHTS
=========================================
Race Status: ${raceState.status} (Elapsed: ${Math.floor(elapsed / 60)}m ${elapsed % 60}s)
Wind Condition: ${typeof raceState.windSpeedKt === 'number' ? `${raceState.windSpeedKt.toFixed(1)} kt @ ${raceState.windDirectionDeg || 0}°` : 'not recorded'}

PODIUM FINISHERS:
1. 🥇 ${winner?.name || 'TBD'} (${winner?.sailNumber || ''}) - Skipper: ${winner?.skipper || 'N/A'}
2. 🥈 ${runnerUp?.name || 'TBD'} (${runnerUp?.sailNumber || ''}) - Skipper: ${runnerUp?.skipper || 'N/A'}
3. 🥉 ${sorted[2]?.name || 'TBD'} (${sorted[2]?.sailNumber || ''})

KEY RACE MOMENTS:
${highlights.length === 0 ? 'None recorded yet.' : highlights
  .map((h, idx) => {
    const sec = h.timestampSec ?? h.timeSec ?? 0;
    return `${idx + 1}. [${Math.floor(sec / 60)
      .toString()
      .padStart(2, '0')}:${(sec % 60)
      .toString()
      .padStart(2, '0')}] ${h.title}\n   ${h.description}`;
  })
  .join('\n')}

Max Speed Recorded: ${maxSpeed.toFixed(1)} kt
Live tracking telemetry via LoRa & WebRTC
`;
}
