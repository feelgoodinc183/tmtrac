import { Boat, CourseMark, RaceState, RaceHighlightMoment } from '../types/regatta';

export function generateRaceHighlights(
  boats: Boat[],
  raceState: RaceState,
  courseMarks: CourseMark[]
): RaceHighlightMoment[] {
  const sorted = [...boats].sort((a, b) => (a.rank || 99) - (b.rank || 99));
  const leader = sorted[0];
  const second = sorted[1];
  const mark1 = courseMarks.find((m) => m.type === 'WINDWARD') || courseMarks[0];
  const finishMark = courseMarks.find((m) => m.type === 'FINISH' || m.type === 'FINISH_PIN' || m.type === 'FINISH_RC') || courseMarks[courseMarks.length - 1];

  const highlights: RaceHighlightMoment[] = [
    {
      id: 'hl-start-gun',
      timeSec: 0,
      timestampSec: 0,
      title: 'Start Gun & Fleet Line Charge',
      subtitle: 'Line charge on starboard tack',
      description: `All ${boats.length} competitors crossed the starting line on starboard tack with fleet speeds up to ${(leader?.speedKt ?? leader?.sog ?? 6.5).toFixed(1)} kt.`,
      type: 'START_GUN',
      icon: 'START',
      boatIds: sorted.slice(0, 3).map((b) => b.id),
      badgeColor: 'bg-green-500/20 text-green-400 border-green-500/40',
    },
    {
      id: 'hl-mark1-rounding',
      timeSec: 340,
      timestampSec: 340,
      title: `Windward Mark 1 (${mark1?.name || 'Mark 1'}) Overlap Duel`,
      subtitle: 'Tactical luffing match',
      description: `${leader ? leader.name : 'Leader'} and ${second ? second.name : 'Challenger'} rounded inside overlapping zone with tactical luffing match.`,
      type: 'MARK_ROUNDING',
      icon: 'MARK',
      markId: mark1?.id,
      boatIds: [leader?.id, second?.id].filter(Boolean) as string[],
      badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
    },
    {
      id: 'hl-downwind-split',
      timeSec: 555,
      timestampSec: 555,
      title: 'Downwind Gybe & Pressure Split',
      subtitle: 'Thermal puff on shoreline',
      description: 'Fleet divided across the course: starboard gybe boats found thermal puff along eastern shoreline.',
      type: 'OVERTAKE',
      icon: 'DUEL',
      boatIds: sorted.slice(1, 4).map((b) => b.id),
      badgeColor: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40',
    },
    {
      id: 'hl-leeward-gate',
      timeSec: 870,
      timestampSec: 870,
      title: 'Leeward Gate Tactical Rounding',
      subtitle: 'Clean spinnaker douses',
      description: 'Clean spinnaker douses and rounding options split the fleet back onto windward beat.',
      type: 'MARK_ROUNDING',
      icon: 'MARK',
      boatIds: sorted.slice(0, 2).map((b) => b.id),
      badgeColor: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
    },
    {
      id: 'hl-finish-duel',
      timeSec: 1185,
      timestampSec: 1185,
      title: 'Photo-Finish at RC Line',
      subtitle: 'Match race duel',
      description: `${leader ? leader.name : 'Winner'} crossed line ahead by a mere tactical boat length!`,
      type: 'FINISH_DUEL',
      icon: 'FINISH',
      markId: finishMark?.id,
      boatIds: [leader?.id, second?.id].filter(Boolean) as string[],
      badgeColor: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
    },
  ];

  return highlights;
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
  const elapsed = raceState.elapsedSeconds ?? raceState.elapsedTimeSeconds ?? 1240;

  return `🏆 REGATTA RACE REPLAY HIGHLIGHTS
=========================================
Race Status: ${raceState.status} (Elapsed: ${Math.floor(elapsed / 60)}m ${elapsed % 60}s)
Wind Condition: ${(raceState.windSpeedKt || 12).toFixed(1)} kt @ ${raceState.windDirectionDeg || 0}°

PODIUM FINISHERS:
1. 🥇 ${winner?.name || 'TBD'} (${winner?.sailNumber || ''}) - Skipper: ${winner?.skipper || 'N/A'}
2. 🥈 ${runnerUp?.name || 'TBD'} (${runnerUp?.sailNumber || ''}) - Skipper: ${runnerUp?.skipper || 'N/A'}
3. 🥉 ${sorted[2]?.name || 'TBD'} (${sorted[2]?.sailNumber || ''})

KEY RACE MOMENTS:
${highlights
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
