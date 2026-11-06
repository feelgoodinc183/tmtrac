import { Boat, BoatRaceResult, BoatStatus, CompletedRace, SeriesStanding, SeriesScoreEntry } from '../types/regatta';

/**
 * Calculates RRS Appendix A Low Point score for a finish rank or penalty status
 */
export function calculateRrsPoints(
  status: BoatStatus,
  rank: number,
  totalBoatsInClass: number
): number {
  if (status === 'FINISHED') {
    return rank;
  }
  if (status === 'OCS' || status === 'DNF' || status === 'DNS' || status === 'RET') {
    return totalBoatsInClass + 1;
  }
  if (status === 'DSQ') {
    return totalBoatsInClass + 2;
  }
  if (status === 'PRE_START') {
    return totalBoatsInClass + 1;
  }
  return rank || totalBoatsInClass + 1;
}

/**
 * Computes overall multi-race series standings for a specific class (or ALL classes)
 * with low-point scoring, discard drop rules, and World Sailing tie-breakers.
 */
export function calculateSeriesStandings(
  races: CompletedRace[],
  allBoats: Boat[],
  selectedClass: string = 'ALL',
  discardRule: 'NONE' | '1_DISCARD_3_RACES' | '1_DISCARD_4_RACES' | 'ALWAYS_1_DISCARD' = '1_DISCARD_3_RACES'
): SeriesStanding[] {
  // Filter eligible races for this class
  const validRaces = races.filter((r) => {
    if (!r.results || r.results.length === 0) return false;
    if (selectedClass === 'ALL') return true;
    if (r.raceClass === selectedClass) return true;
    if (r.raceClass === 'ALL' || !r.raceClass) {
      return r.results.some((res) => res.class === selectedClass);
    }
    return false;
  });
  if (validRaces.length === 0) return [];

  // Collect all distinct boats from active fleet as well as race results
  const boatMap = new Map<string, Boat>();
  allBoats.forEach((b) => {
    const key = (b.sailNumber || b.id).toLowerCase().trim();
    boatMap.set(key, b);
  });
  validRaces.forEach((r) => {
    r.results?.forEach((res) => {
      const key = (res.sailNumber || res.boatId).toLowerCase().trim();
      if (!boatMap.has(key)) {
        boatMap.set(key, {
          id: res.boatId || `boat-hist-${key}`,
          name: res.boatName || 'Unknown Boat',
          sailNumber: res.sailNumber || '---',
          class: res.class || r.raceClass || 'Class 1',
          skipper: res.skipper || 'Competitor',
          handicapSystem: res.handicapSystem || 'IRC',
          handicapRating: res.handicapRating || 1.0,
          color: res.color || '#00D4FF',
          nodeId: null,
          lat: 0,
          lng: 0,
          sog: 0,
          cog: 0,
          vmg: 0,
          heading: 0,
          status: res.status || 'FINISHED',
          elapsedSeconds: res.elapsedSeconds || 0,
          correctedSeconds: res.correctedSeconds || 0,
          rank: res.rank || 1,
          dtw: 0,
          markRoundings: res.markRoundings || [],
          trail: [],
        });
      }
    });
  });

  // Filter boats in this class
  const classBoats = Array.from(boatMap.values()).filter(
    (b) => selectedClass === 'ALL' || b.class === selectedClass
  );

  // Determine if a discard should be applied based on number of completed races
  const numRaces = validRaces.length;
  let applyDiscard = false;
  if (discardRule === 'ALWAYS_1_DISCARD' && numRaces >= 2) applyDiscard = true;
  else if (discardRule === '1_DISCARD_3_RACES' && numRaces >= 3) applyDiscard = true;
  else if (discardRule === '1_DISCARD_4_RACES' && numRaces >= 4) applyDiscard = true;

  const standings: SeriesStanding[] = classBoats.map((boat) => {
    const raceScores: SeriesScoreEntry[] = [];
    const pointsList: { raceIndex: number; points: number }[] = [];

    validRaces.forEach((race, rIdx) => {
      // Find this boat's result in the race
      const res = race.results.find((r) => r.boatId === boat.id || r.sailNumber === boat.sailNumber);
      
      const totalInRaceClass = race.results.filter(
        (r) => selectedClass === 'ALL' || r.class === boat.class
      ).length || classBoats.length;

      let points = totalInRaceClass + 1; // Default DNC
      let rank = totalInRaceClass + 1;
      let status: BoatStatus = 'DNS';
      let correctedSeconds = 0;
      let elapsedSeconds = 0;

      if (res) {
        points = res.rrsPoints;
        rank = res.rank;
        status = res.status;
        correctedSeconds = res.correctedSeconds;
        elapsedSeconds = res.elapsedSeconds;
      }

      raceScores.push({
        raceNumber: race.raceNumber,
        raceId: race.id,
        points,
        rank,
        status,
        isDiscarded: false,
        correctedSeconds,
        elapsedSeconds,
      });

      pointsList.push({ raceIndex: rIdx, points });
    });

    // Mark worst race as discarded if discard rule met
    if (applyDiscard && pointsList.length > 1) {
      // Find highest point score (worst race)
      let worstIdx = 0;
      let maxPts = -1;
      pointsList.forEach((p) => {
        if (p.points > maxPts) {
          maxPts = p.points;
          worstIdx = p.raceIndex;
        }
      });
      raceScores[worstIdx].isDiscarded = true;
    }

    const totalPoints = raceScores.reduce((sum, s) => sum + s.points, 0);
    const nettPoints = raceScores.reduce((sum, s) => sum + (s.isDiscarded ? 0 : s.points), 0);

    return {
      boatId: boat.id,
      boatName: boat.name,
      sailNumber: boat.sailNumber,
      class: boat.class,
      skipper: boat.skipper,
      handicapSystem: boat.handicapSystem,
      handicapRating: boat.handicapRating,
      color: boat.color,
      raceScores,
      totalPoints: +totalPoints.toFixed(1),
      nettPoints: +nettPoints.toFixed(1),
      seriesRank: 1, // Will be calculated after sort
    };
  });

  // Sort series standings:
  // 1. Lowest Nett Points
  // 2. Tie-break: Most 1st places, then 2nd places, then 3rd places (RRS A8.1)
  // 3. Better score in the most recent completed race (RRS A8.2)
  standings.sort((a, b) => {
    if (a.nettPoints !== b.nettPoints) {
      return a.nettPoints - b.nettPoints;
    }

    // Tie-break A8.1: Most 1sts, 2nds, 3rds
    for (let place = 1; place <= 10; place++) {
      const countA = a.raceScores.filter((s) => s.rank === place && !s.isDiscarded).length;
      const countB = b.raceScores.filter((s) => s.rank === place && !s.isDiscarded).length;
      if (countA !== countB) return countB - countA;
    }

    // Tie-break A8.2: Last race result
    const lastA = a.raceScores[a.raceScores.length - 1]?.points || 99;
    const lastB = b.raceScores[b.raceScores.length - 1]?.points || 99;
    return lastA - lastB;
  });

  // Assign 1-indexed Series Rank
  return standings.map((s, idx) => ({
    ...s,
    seriesRank: idx + 1,
  }));
}

/**
 * Creates a CompletedRace snapshot from current live fleet positions and mark times
 */
export function buildRaceSnapshotFromBoats(
  raceNumber: number,
  raceTitle: string,
  boats: Boat[],
  selectedClass: string = 'ALL',
  windSpeedKt: number = 14.2,
  windDirectionDeg: number = 210
): CompletedRace {
  const filteredBoats = boats.filter(
    (b) => selectedClass === 'ALL' || b.class === selectedClass
  );

  // Sort boats for final results
  const sorted = [...filteredBoats].sort((a, b) => {
    const isFinA = a.status === 'FINISHED';
    const isFinB = b.status === 'FINISHED';
    if (isFinA && !isFinB) return -1;
    if (!isFinA && isFinB) return 1;
    if (isFinA && isFinB) return a.correctedSeconds - b.correctedSeconds;

    const aPenalty = ['OCS', 'DNF', 'DNS', 'DSQ'].includes(a.status);
    const bPenalty = ['OCS', 'DNF', 'DNS', 'DSQ'].includes(b.status);
    if (!aPenalty && bPenalty) return -1;
    if (aPenalty && !bPenalty) return 1;

    return (b.markRoundings?.length || 0) - (a.markRoundings?.length || 0);
  });

  const totalBoats = sorted.length;

  const results: BoatRaceResult[] = sorted.map((b, idx) => {
    const rank = idx + 1;
    // Auto-detect DNF or DNS for unfinished racing boats
    let finalStatus = b.status;
    if (finalStatus !== 'FINISHED' && finalStatus !== 'OCS' && finalStatus !== 'DSQ' && finalStatus !== 'RET' && finalStatus !== 'DNF' && finalStatus !== 'DNS') {
      const hasStarted =
        finalStatus === 'RACING' ||
        finalStatus === 'CLEARED_OCS' ||
        (b.elapsedSeconds && b.elapsedSeconds > 0) ||
        (b.markRoundings && b.markRoundings.length > 0);
      finalStatus = (finalStatus === 'PRE_START' || !hasStarted) ? 'DNS' : 'DNF';
    }

    const rrsPoints = calculateRrsPoints(finalStatus, rank, totalBoats);

    return {
      boatId: b.id,
      boatName: b.name,
      sailNumber: b.sailNumber,
      class: b.class,
      handicapSystem: b.handicapSystem,
      handicapRating: b.handicapRating,
      skipper: b.skipper,
      status: finalStatus,
      elapsedSeconds: Math.round(b.elapsedSeconds || 0),
      correctedSeconds: Math.round(b.correctedSeconds || 0),
      rank,
      rrsPoints,
      markRoundings: [...(b.markRoundings || [])],
      color: b.color,
    };
  });

  const classPrefix = selectedClass.toLowerCase().replace(/[^a-z0-9]/g, '');

  return {
    id: `race-${classPrefix}-${raceNumber}-${Date.now()}`,
    raceNumber,
    raceTitle: typeof raceTitle === 'string' ? raceTitle : (selectedClass === 'ALL' ? `Race ${raceNumber}` : `${selectedClass} - Race ${raceNumber}`),
    raceClass: selectedClass,
    completedAt: Date.now(),
    windSpeedKt,
    windDirectionDeg,
    results,
    status: 'COMPLETED',
  };
}

/**
 * Initial Multi-Race Historical Series Data for the regatta
 * Pre-populated with realistic mark roundings, leg splits, and historical results for R1 & R2
 */
export const INITIAL_SERIES_RACES: CompletedRace[] = [];

/**
 * Generates an official World Sailing XML document string
 * compliant with international regatta result exchange specifications.
 */
export function exportToWorldSailingXml(
  seriesName: string,
  selectedClass: string,
  standings: SeriesStanding[],
  races: CompletedRace[]
): string {
  const dateStr = new Date().toISOString();
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<RegattaResults xmlns="http://www.sailing.org/standards/results/v1" generated="${dateStr}">\n`;
  xml += `  <Event name="${escapeXml(seriesName)}" scoringSystem="RRS_APPENDIX_A_LOW_POINT">\n`;
  xml += `    <Class name="${escapeXml(selectedClass)}">\n`;
  
  // Races list
  xml += `      <Races count="${races.length}">\n`;
  races.forEach((r, idx) => {
    xml += `        <Race number="${r.raceNumber || idx + 1}" title="${escapeXml(r.raceTitle || `Race ${r.raceNumber}`)}" date="${new Date(r.completedAt).toISOString()}" windSpeedKt="${r.windSpeedKt || ''}" windDirectionDeg="${r.windDirectionDeg || ''}" />\n`;
  });
  xml += `      </Races>\n`;

  // Competitors & Overall Series Standings
  xml += `      <Competitors count="${standings.length}">\n`;
  standings.forEach((s) => {
    xml += `        <Competitor id="${escapeXml(s.boatId)}" rank="${s.seriesRank}" netPoints="${s.nettPoints}" totalPoints="${s.totalPoints}">\n`;
    xml += `          <BoatName>${escapeXml(s.boatName)}</BoatName>\n`;
    xml += `          <SailNumber>${escapeXml(s.sailNumber)}</SailNumber>\n`;
    xml += `          <Skipper>${escapeXml(s.skipper || '')}</Skipper>\n`;
    xml += `          <Class>${escapeXml(s.class)}</Class>\n`;
    xml += `          <Scores>\n`;
    s.raceScores.forEach((rs) => {
      xml += `            <Score race="${rs.raceNumber}" points="${rs.points}" status="${rs.status}" isDiscarded="${rs.isDiscarded}" rank="${rs.rank || ''}" />\n`;
    });
    xml += `          </Scores>\n`;
    xml += `        </Competitor>\n`;
  });
  xml += `      </Competitors>\n`;

  xml += `    </Class>\n`;
  xml += `  </Event>\n`;
  xml += `</RegattaResults>`;
  return xml;
}

/**
 * Generates a Sailwave-compatible CSV exchange string
 */
export function exportToSailwaveCsv(
  seriesName: string,
  selectedClass: string,
  standings: SeriesStanding[],
  races: CompletedRace[]
): string {
  const raceCols = races.map((_, i) => `"R${i + 1}"`).join(',');
  let csv = `"Rank","Boat","SailNo","Class","Rating","HelmName",${raceCols},"Total","Nett"\n`;

  standings.forEach((s) => {
    const scores = races.map((_, i) => {
      const entry = s.raceScores[i];
      if (!entry) return '""';
      if (entry.isDiscarded) return `"[${entry.points}]"`;
      return `"${entry.points}"`;
    }).join(',');

    csv += `"${s.seriesRank}","${escapeCsv(s.boatName)}","${escapeCsv(s.sailNumber)}","${escapeCsv(s.class)}","${s.handicapRating || 1.0}","${escapeCsv(s.skipper || '')}",${scores},"${s.totalPoints}","${s.nettPoints}"\n`;
  });

  return csv;
}

/**
 * Parses uploaded CSV or JSON competitor rosters into structured records
 */
export function parseCompetitorRoster(fileText: string): {
  success: boolean;
  records: Array<{
    name: string;
    sailNumber: string;
    skipper: string;
    className: string;
    handicapRating?: number;
    club?: string;
  }>;
  error?: string;
} {
  try {
    const trimmed = fileText.trim();
    if (!trimmed) {
      return { success: false, records: [], error: 'File is empty' };
    }

    // Try parsing as JSON first
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      const data = JSON.parse(trimmed);
      const list = Array.isArray(data) ? data : data.competitors || data.boats || [data];
      const parsed = list.map((item: any) => ({
        name: String(item.name || item.boatName || item.Boat || 'Unnamed Boat').trim(),
        sailNumber: String(item.sailNumber || item.sailNo || item.SailNo || 'MAS 00').trim(),
        skipper: String(item.skipper || item.helmName || item.HelmName || item.captain || 'Skipper').trim(),
        className: String(item.className || item.class || item.Class || 'Class 1').trim(),
        handicapRating: Number(item.handicapRating || item.rating || item.Rating || 1.0) || 1.0,
        club: item.club ? String(item.club).trim() : undefined,
      }));
      return { success: true, records: parsed };
    }

    // Otherwise parse as CSV
    const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      return { success: false, records: [], error: 'CSV requires a header and at least one data row' };
    }

    const header = lines[0].toLowerCase().split(',').map((h) => h.replace(/["']/g, '').trim());
    const nameIdx = header.findIndex((h) => h.includes('boat') || h.includes('name'));
    const sailIdx = header.findIndex((h) => h.includes('sail'));
    const skipperIdx = header.findIndex((h) => h.includes('skipper') || h.includes('helm') || h.includes('captain'));
    const classIdx = header.findIndex((h) => h.includes('class') || h.includes('division'));
    const ratingIdx = header.findIndex((h) => h.includes('rating') || h.includes('handicap') || h.includes('py') || h.includes('irc'));
    const clubIdx = header.findIndex((h) => h.includes('club') || h.includes('yachtclub'));

    const records = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // Regex to split respecting quotes
      const cells = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((c) => c.replace(/^"|"$/g, '').trim());
      if (cells.length === 0 || !cells[0]) continue;

      records.push({
        name: (nameIdx >= 0 ? cells[nameIdx] : cells[0]) || `Boat ${i}`,
        sailNumber: (sailIdx >= 0 ? cells[sailIdx] : cells[1]) || `MAS ${i}`,
        skipper: (skipperIdx >= 0 ? cells[skipperIdx] : cells[2]) || 'Skipper',
        className: (classIdx >= 0 ? cells[classIdx] : 'Class 1') || 'Class 1',
        handicapRating: ratingIdx >= 0 ? parseFloat(cells[ratingIdx]) || 1.0 : 1.0,
        club: clubIdx >= 0 ? cells[clubIdx] : undefined,
      });
    }

    return { success: true, records };
  } catch (err: any) {
    return { success: false, records: [], error: err.message || 'Failed to parse roster file' };
  }
}

function escapeXml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeCsv(str: string): string {
  return String(str).replace(/"/g, '""');
}
