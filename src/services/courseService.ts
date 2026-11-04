import { Boat, CourseMark, CourseLeg, MarkRounding, BackfillPoint } from '../types/regatta';

/**
 * Great-circle distance calculation in Nautical Miles (NM)
 */
export function calculateDistanceNm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  if (
    typeof lat1 !== 'number' ||
    typeof lng1 !== 'number' ||
    typeof lat2 !== 'number' ||
    typeof lng2 !== 'number' ||
    !Number.isFinite(lat1) ||
    !Number.isFinite(lng1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lng2)
  ) {
    return 0;
  }
  if (lat1 === lat2 && lng1 === lng2) return 0;
  const R = 3440.065; // Earth radius in nautical miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(Math.max(0, Math.min(1, a))), Math.sqrt(Math.max(0, 1 - Math.min(1, a))));
  const dist = R * c;
  return Number.isFinite(dist) ? +(dist).toFixed(3) : 0;
}

/**
 * Compass bearing from point 1 to point 2 in degrees (0 - 359)
 */
export function calculateBearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  if (
    typeof lat1 !== 'number' ||
    typeof lng1 !== 'number' ||
    typeof lat2 !== 'number' ||
    typeof lng2 !== 'number' ||
    !Number.isFinite(lat1) ||
    !Number.isFinite(lng1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lng2)
  ) {
    return 0;
  }
  const y = Math.sin(((lng2 - lng1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(((lng2 - lng1) * Math.PI) / 180);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  if (!Number.isFinite(brng)) return 0;
  return Math.round((brng + 360) % 360);
}

/**
 * Helper to determine if a mark is a Start Line element
 */
export function isStartMark(m: CourseMark): boolean {
  return m.type === 'PIN_END' || m.type === 'RC_BOAT';
}

/**
 * Helper to determine if a mark is a Finish Line element
 */
export function isFinishMark(m: CourseMark): boolean {
  return m.type === 'FINISH' || m.type === 'FINISH_PIN' || m.type === 'FINISH_RC';
}

/**
 * Helper to determine if a mark is a sequential course mark (Marks 1, 2, 3, ...)
 */
export function isSequentialCourseMark(m: CourseMark): boolean {
  return !isStartMark(m) && !isFinishMark(m);
}

/**
 * Re-indexes all sequential marks to guarantee contiguous 1, 2, 3, 4... numbers.
 * If Mark 3 is deleted, Mark 4 becomes Mark 3.
 */
export function reindexCourseMarks(marks: CourseMark[]): CourseMark[] {
  const startMarks: CourseMark[] = [];
  const finishMarks: CourseMark[] = [];
  const seqMarks: CourseMark[] = [];

  marks.forEach((m) => {
    if (isStartMark(m)) {
      startMarks.push({
        ...m,
        orderIndex: 0,
        shortName: m.type === 'PIN_END' ? 'SP' : 'RC',
      });
    } else if (isFinishMark(m)) {
      finishMarks.push({
        ...m,
        orderIndex: 999,
        shortName: m.type === 'FINISH_PIN' ? 'FP' : m.type === 'FINISH_RC' ? 'FR' : 'F',
      });
    } else {
      seqMarks.push(m);
    }
  });

  // Re-number sequential course marks 1, 2, 3...
  const updatedSeqMarks: CourseMark[] = seqMarks.map((m, idx) => {
    const markNumber = idx + 1;
    let newName = m.name;

    // Replace leading "Mark X" pattern or prefix with new number
    const markMatch = m.name.match(/^Mark\s+\d+(\s*\(.*\))?/i);
    if (markMatch) {
      const suffix = markMatch[1] ? markMatch[1] : '';
      newName = `Mark ${markNumber}${suffix}`;
    } else if (m.name.startsWith('MARK ')) {
      const parts = m.name.split('(');
      const suffix = parts.length > 1 ? ` (${parts[1]}` : '';
      newName = `Mark ${markNumber}${suffix}`;
    }

    return {
      ...m,
      orderIndex: markNumber,
      shortName: `${markNumber}`,
      name: newName,
      color: m.color || '#FBBC04',
    };
  });

  return [...startMarks, ...updatedSeqMarks, ...finishMarks];
}

/**
 * Adds a new course mark at the given coordinates with automatic sequential numbering.
 */
export function addCourseMark(
  currentMarks: CourseMark[],
  lat: number,
  lng: number,
  type: CourseMark['type'] = 'WINDWARD',
  customName?: string
): CourseMark[] {
  const seqCount = currentMarks.filter(isSequentialCourseMark).length;
  const nextNumber = seqCount + 1;

  const defaultNameByType: Record<string, string> = {
    WINDWARD: `Mark ${nextNumber} (Windward)`,
    WING: `Mark ${nextNumber} (Wing)`,
    LEEWARD: `Mark ${nextNumber} (Leeward)`,
    GATE: `Mark ${nextNumber} (Gate)`,
    CUSTOM_MARK: `Mark ${nextNumber}`,
  };

  const newMark: CourseMark = {
    id: `mark-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    orderIndex: nextNumber,
    name: customName || defaultNameByType[type] || `Mark ${nextNumber}`,
    shortName: `${nextNumber}`,
    type,
    lat,
    lng,
    radiusMeters: 40,
    requiredRounding: 'PORT',
    color: '#FBBC04',
  };

  // Insert before finish marks if any exist
  const finishIdx = currentMarks.findIndex(isFinishMark);
  let updatedList: CourseMark[];
  if (finishIdx >= 0) {
    updatedList = [...currentMarks.slice(0, finishIdx), newMark, ...currentMarks.slice(finishIdx)];
  } else {
    updatedList = [...currentMarks, newMark];
  }

  return reindexCourseMarks(updatedList);
}

/**
 * Removes a course mark and automatically shifts subsequent mark numbers (e.g. 4 becomes 3).
 */
export function removeCourseMark(currentMarks: CourseMark[], markId: string): CourseMark[] {
  const filtered = currentMarks.filter((m) => m.id !== markId);
  return reindexCourseMarks(filtered);
}

/**
 * Moves a sequential mark up or down in the course order.
 */
export function moveMarkOrder(currentMarks: CourseMark[], markId: string, direction: 'UP' | 'DOWN'): CourseMark[] {
  const seqMarks = currentMarks.filter(isSequentialCourseMark);
  const otherMarks = currentMarks.filter((m) => !isSequentialCourseMark(m));

  const targetIdx = seqMarks.findIndex((m) => m.id === markId);
  if (targetIdx < 0) return currentMarks;

  if (direction === 'UP' && targetIdx > 0) {
    const temp = seqMarks[targetIdx];
    seqMarks[targetIdx] = seqMarks[targetIdx - 1];
    seqMarks[targetIdx - 1] = temp;
  } else if (direction === 'DOWN' && targetIdx < seqMarks.length - 1) {
    const temp = seqMarks[targetIdx];
    seqMarks[targetIdx] = seqMarks[targetIdx + 1];
    seqMarks[targetIdx + 1] = temp;
  }

  const startMarks = otherMarks.filter(isStartMark);
  const finishMarks = otherMarks.filter(isFinishMark);

  return reindexCourseMarks([...startMarks, ...seqMarks, ...finishMarks]);
}

/**
 * Updates a mark's coordinates (from map drag or click).
 */
export function updateMarkCoordinates(
  currentMarks: CourseMark[],
  markId: string,
  lat: number,
  lng: number
): CourseMark[] {
  return currentMarks.map((m) => {
    if (m.id === markId) {
      return { ...m, lat, lng };
    }
    return m;
  });
}

/**
 * Updates mark settings (name, radius, rounding direction).
 */
export function updateMarkSettings(
  currentMarks: CourseMark[],
  markId: string,
  partial: Partial<CourseMark>
): CourseMark[] {
  const updated = currentMarks.map((m) => {
    if (m.id === markId) {
      return { ...m, ...partial };
    }
    return m;
  });
  return reindexCourseMarks(updated);
}

/**
 * Calculates the ordered sequence of course rounding waypoints from start to finish.
 */
export function getOrderedCourseSequence(marks: CourseMark[]): CourseMark[] {
  const validMarks = (marks || []).filter(
    (m) => m && typeof m.lat === 'number' && typeof m.lng === 'number' && Number.isFinite(m.lat) && Number.isFinite(m.lng)
  );

  const pin = validMarks.find((m) => m.type === 'PIN_END');
  const rc = validMarks.find((m) => m.type === 'RC_BOAT');
  const finishPin = validMarks.find((m) => m.type === 'FINISH_PIN' || m.type === 'FINISH');
  const finishRc = validMarks.find((m) => m.type === 'FINISH_RC');

  const seqMarks = validMarks.filter(isSequentialCourseMark).sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

  const sequence: CourseMark[] = [];

  // Start Line reference point (Midpoint)
  if (pin && rc && Number.isFinite(pin.lat) && Number.isFinite(rc.lat) && Number.isFinite(pin.lng) && Number.isFinite(rc.lng)) {
    const midLat = +((pin.lat + rc.lat) / 2).toFixed(6);
    const midLng = +((pin.lng + rc.lng) / 2).toFixed(6);
    if (Number.isFinite(midLat) && Number.isFinite(midLng)) {
      sequence.push({
        id: 'start-line-midpoint',
        name: 'Start Line',
        shortName: 'START',
        type: 'PIN_END',
        lat: midLat,
        lng: midLng,
        radiusMeters: 35,
        requiredRounding: 'LINE',
        color: '#00D4FF',
        orderIndex: 0,
      });
    }
  } else if (pin) {
    sequence.push(pin);
  } else if (rc) {
    sequence.push(rc);
  }

  // Intermediate Marks 1, 2, 3...
  sequence.push(...seqMarks);

  // Finish Line reference point
  if (finishPin && finishRc && Number.isFinite(finishPin.lat) && Number.isFinite(finishRc.lat) && Number.isFinite(finishPin.lng) && Number.isFinite(finishRc.lng)) {
    const midLat = +((finishPin.lat + finishRc.lat) / 2).toFixed(6);
    const midLng = +((finishPin.lng + finishRc.lng) / 2).toFixed(6);
    if (Number.isFinite(midLat) && Number.isFinite(midLng)) {
      sequence.push({
        id: 'finish-line-midpoint',
        name: 'Finish Line',
        shortName: 'FINISH',
        type: 'FINISH',
        lat: midLat,
        lng: midLng,
        radiusMeters: 35,
        requiredRounding: 'LINE',
        color: '#00FF9D',
        orderIndex: 999,
      });
    }
  } else if (finishPin) {
    sequence.push(finishPin);
  } else if (finishRc) {
    sequence.push(finishRc);
  }

  return sequence.filter(
    (s) => s && typeof s.lat === 'number' && typeof s.lng === 'number' && Number.isFinite(s.lat) && Number.isFinite(s.lng)
  );
}

/**
 * Calculates the shortest distance in Nautical Miles from a point (pLat, pLng)
 * to a line segment connecting (aLat, aLng) and (bLat, bLng).
 * This provides Closest Point of Approach (CPA) so high-speed boats or sparse GPS updates
 * never miss a mark rounding geofence.
 */
export function distanceToSegmentNm(
  pLat: number,
  pLng: number,
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  if (
    typeof pLat !== 'number' || typeof pLng !== 'number' ||
    !Number.isFinite(pLat) || !Number.isFinite(pLng)
  ) {
    return 999;
  }
  if (
    typeof aLat !== 'number' || typeof aLng !== 'number' ||
    typeof bLat !== 'number' || typeof bLng !== 'number' ||
    !Number.isFinite(aLat) || !Number.isFinite(aLng) ||
    !Number.isFinite(bLat) || !Number.isFinite(bLng)
  ) {
    return calculateDistanceNm(pLat, pLng, aLat || bLat || pLat, aLng || bLng || pLng);
  }

  const dx = bLng - aLng;
  const dy = bLat - aLat;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return calculateDistanceNm(pLat, pLng, aLat, aLng);
  }

  // Projection scalar t clamped to [0, 1] on the segment
  const t = Math.max(0, Math.min(1, ((pLng - aLng) * dx + (pLat - aLat) * dy) / lenSq));
  const projLat = aLat + t * dy;
  const projLng = aLng + t * dx;

  return calculateDistanceNm(pLat, pLng, projLat, projLng);
}

/**
 * Calculates the legs, distances, and bearings between successive course marks.
 */
export function calculateCourseLegs(marks: CourseMark[]): CourseLeg[] {
  const sequence = getOrderedCourseSequence(marks);
  if (sequence.length < 2) return [];

  const legs: CourseLeg[] = [];
  for (let i = 0; i < sequence.length - 1; i++) {
    const from = sequence[i];
    const to = sequence[i + 1];
    if (!from || !to || !Number.isFinite(from.lat) || !Number.isFinite(from.lng) || !Number.isFinite(to.lat) || !Number.isFinite(to.lng)) {
      continue;
    }
    const distNm = calculateDistanceNm(from.lat, from.lng, to.lat, to.lng);
    const brng = calculateBearingDeg(from.lat, from.lng, to.lat, to.lng);

    legs.push({
      fromMark: from,
      toMark: to,
      distanceNm: distNm,
      bearingDeg: brng,
      legNumber: i + 1,
      label: `Leg ${i + 1}: ${from.shortName} → ${to.shortName} (${distNm} NM, ${brng}°)`,
    });
  }

  return legs;
}

/**
 * Evaluates a boat's race progression against all custom dropped course marks.
 * Supports discrete GPS fixes, track-segment Closest Point of Approach (CPA),
 * and automatic sequential progression from Start -> Mark 1 -> Mark 2 -> Finish.
 */
export function evaluateBoatCourseProgress(
  boat: Boat,
  marks: CourseMark[],
  countdownSeconds: number,
  prevLat?: number,
  prevLng?: number
): {
  targetMark: CourseMark | null;
  targetIndex: number;
  totalMarks: number;
  dtwNm: number;
  isOcs: boolean;
  isFinished: boolean;
  currentLegName: string;
  updatedRoundings: MarkRounding[];
  newlyRounded: boolean;
} {
  const validMarks = (marks || []).filter(
    (m) => m && typeof m.lat === 'number' && typeof m.lng === 'number' && Number.isFinite(m.lat) && Number.isFinite(m.lng)
  );

  const seqMarks = validMarks.filter(isSequentialCourseMark).sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  const pin = validMarks.find((m) => m.type === 'PIN_END');
  const rc = validMarks.find((m) => m.type === 'RC_BOAT');
  const finishPin = validMarks.find((m) => m.type === 'FINISH_PIN' || m.type === 'FINISH');
  const finishRc = validMarks.find((m) => m.type === 'FINISH_RC');

  // Build the list of active rounding waypoints: [Mark 1, Mark 2, ... Finish]
  const roundingWaypoints: CourseMark[] = [...seqMarks];

  let finishWaypoint: CourseMark | null = null;
  if (finishPin && finishRc) {
    const midLat = +((finishPin.lat + finishRc.lat) / 2).toFixed(6);
    const midLng = +((finishPin.lng + finishRc.lng) / 2).toFixed(6);
    finishWaypoint = {
      id: 'finish-line-midpoint',
      name: 'Finish Line',
      shortName: 'FINISH',
      type: 'FINISH',
      lat: midLat,
      lng: midLng,
      radiusMeters: Math.max(50, finishPin.radiusMeters || 50),
      requiredRounding: 'LINE',
      color: '#00FF9D',
      orderIndex: 999,
    };
  } else if (finishPin) {
    finishWaypoint = finishPin;
  } else if (finishRc) {
    finishWaypoint = finishRc;
  }

  if (finishWaypoint) {
    roundingWaypoints.push(finishWaypoint);
  }

  const totalMarks = roundingWaypoints.length;
  if (totalMarks === 0) {
    return {
      targetMark: null,
      targetIndex: 0,
      totalMarks: 0,
      dtwNm: 0,
      isOcs: false,
      isFinished: boat.status === 'FINISHED',
      currentLegName: 'Free Sailing',
      updatedRoundings: boat.markRoundings || [],
      newlyRounded: false,
    };
  }

  const roundedIds = new Set((boat.markRoundings || []).map((r) => r.markId));
  let newlyRounded = false;
  const updatedRoundings = [...(boat.markRoundings || [])];

  // Auto-record Start Line entry if race is underway or boat has already started
  const isRacingOrActive = countdownSeconds <= 0 || boat.status === 'RACING' || (boat.elapsedSeconds || 0) > 0;
  const hasStartRounding = updatedRoundings.some((r) => r.markId === 'start-line-midpoint' || r.markId === 'start-line' || r.markName.toLowerCase().includes('start'));
  
  if (isRacingOrActive && !hasStartRounding && (pin || rc)) {
    const startId = pin?.id || 'start-line-midpoint';
    updatedRoundings.unshift({
      markId: startId,
      markName: 'Start Line',
      roundedAt: Date.now() - Math.round((boat.elapsedSeconds || 0) * 1000),
      elapsedAtSec: 0,
      legDurationSec: 0,
      legSpeedKt: typeof boat.sog === 'number' && boat.sog > 0 ? +boat.sog.toFixed(1) : 6.0,
      roundingDirection: 'LINE',
      isValid: true,
    });
    roundedIds.add(startId);
  }

  // Find previous position for segment CPA analysis (from arguments or trail)
  let lastLat = prevLat;
  let lastLng = prevLng;
  if ((lastLat === undefined || lastLng === undefined) && Array.isArray(boat.trail) && boat.trail.length >= 2) {
    const prevFix = boat.trail[boat.trail.length - 2];
    if (prevFix && Number.isFinite(prevFix.lat) && Number.isFinite(prevFix.lng)) {
      lastLat = prevFix.lat;
      lastLng = prevFix.lng;
    }
  }

  // Evaluate sequential waypoint progression
  let targetIdx = 0;
  for (let i = 0; i < roundingWaypoints.length; i++) {
    const wp = roundingWaypoints[i];
    if (!roundedIds.has(wp.id)) {
      targetIdx = i;
      break;
    }
    if (i === roundingWaypoints.length - 1) {
      targetIdx = roundingWaypoints.length; // All marks rounded
    }
  }

  // If countdown is active, boat cannot be finished
  let isAlreadyFinished = (countdownSeconds > 0) ? false : (boat.status === 'FINISHED' || (roundingWaypoints.length > 0 && targetIdx >= roundingWaypoints.length));
  let targetMark: CourseMark | null = null;
  let dtwNm = 0;
  let currentLegName = (countdownSeconds > 0) ? 'Pre-Start' : (isAlreadyFinished ? 'Finished' : 'Racing');

  // Check if boat is in the rounding zone of target mark (or subsequent marks)
  if (!isAlreadyFinished && targetIdx < roundingWaypoints.length) {
    targetMark = roundingWaypoints[targetIdx];
    dtwNm = calculateDistanceNm(boat.lat, boat.lng, targetMark.lat, targetMark.lng);

    const prevMarkName = targetIdx > 0 ? (roundingWaypoints[targetIdx - 1].shortName || roundingWaypoints[targetIdx - 1].name) : 'START';
    currentLegName = `Leg ${targetIdx + 1}: ${prevMarkName} → ${targetMark.shortName || targetMark.name}`;

    // Loop through upcoming waypoints in order to allow advancing if boat rounded or passed CPA
    for (let checkIdx = targetIdx; checkIdx < roundingWaypoints.length; checkIdx++) {
      const markToCheck = roundingWaypoints[checkIdx];
      if (roundedIds.has(markToCheck.id)) continue;

      const directDistNm = calculateDistanceNm(boat.lat, boat.lng, markToCheck.lat, markToCheck.lng);
      
      // Calculate CPA distance from the boat's track segment
      let segmentDistNm = directDistNm;
      if (lastLat !== undefined && lastLng !== undefined && Number.isFinite(lastLat) && Number.isFinite(lastLng)) {
        segmentDistNm = distanceToSegmentNm(markToCheck.lat, markToCheck.lng, lastLat, lastLng, boat.lat, boat.lng);
      }

      const effectiveDistNm = Math.min(directDistNm, segmentDistNm);

      // Generous geofence threshold: minimum 65m (~0.035 NM) or mark's defined radius
      const markRadiusMeters = Math.max(65, markToCheck.radiusMeters || 65);
      const thresholdNm = markRadiusMeters / 1852;

      // Only allow rounding markToCheck if it is the current target OR if direct distance is very close
      if (effectiveDistNm <= thresholdNm && (checkIdx === targetIdx || directDistNm <= thresholdNm * 0.8)) {
        const prevRounding = updatedRoundings[updatedRoundings.length - 1];
        const prevElapsed = prevRounding?.elapsedAtSec ?? 0;
        const currentElapsed = Math.max(prevElapsed + 1, Math.round(boat.elapsedSeconds || 0));
        const legDuration = Math.max(1, currentElapsed - prevElapsed);
        const sog = typeof boat.sog === 'number' && boat.sog > 0 ? +boat.sog.toFixed(1) : 7.2;

        updatedRoundings.push({
          markId: markToCheck.id,
          markName: markToCheck.name,
          roundedAt: Date.now(),
          elapsedAtSec: currentElapsed,
          legDurationSec: legDuration,
          legSpeedKt: sog,
          roundingDirection: markToCheck.requiredRounding === 'STARBOARD' ? 'STARBOARD' : (markToCheck.requiredRounding === 'LINE' ? 'LINE' : 'PORT'),
          isValid: true,
        });

        roundedIds.add(markToCheck.id);
        newlyRounded = true;
        targetIdx = checkIdx + 1;

        if (targetIdx < roundingWaypoints.length) {
          targetMark = roundingWaypoints[targetIdx];
          dtwNm = calculateDistanceNm(boat.lat, boat.lng, targetMark.lat, targetMark.lng);
          const newPrevName = roundingWaypoints[targetIdx - 1].shortName || roundingWaypoints[targetIdx - 1].name;
          currentLegName = `Leg ${targetIdx + 1}: ${newPrevName} → ${targetMark.shortName || targetMark.name}`;
        } else {
          targetMark = null;
          dtwNm = 0;
          currentLegName = 'Finished';
          isAlreadyFinished = true;
          break;
        }
      } else {
        // Stop checking further ahead if this waypoint was not rounded
        break;
      }
    }
  }

  // OCS Start Line crossing check
  // World Sailing RRS: Boats cannot be OCS before the starting gun (countdownSeconds > 0).
  // Once cleared by RC or by dipping back behind the line, OCS is cleared.
  let isOcs = boat.status === 'OCS';
  if (boat.status === 'CLEARED_OCS') {
    isOcs = false;
  } else if (pin && rc) {
    const lineLat = (pin.lat + rc.lat) / 2;
    const firstSeqMark = roundingWaypoints[0];
    const isNorthwardCourse = firstSeqMark ? firstSeqMark.lat > lineLat : true;

    if (isOcs) {
      // If boat returns behind the starting line to clear OCS
      const hasReturned = isNorthwardCourse ? boat.lat <= lineLat - 0.0001 : boat.lat >= lineLat + 0.0001;
      if (hasReturned) {
        isOcs = false;
      }
    }
  }

  const isFinished = (countdownSeconds > 0)
    ? false
    : (isAlreadyFinished || (roundingWaypoints.length > 0 && targetIdx >= roundingWaypoints.length));

  return {
    targetMark,
    targetIndex: targetIdx,
    totalMarks,
    dtwNm: +dtwNm.toFixed(2),
    isOcs,
    isFinished,
    currentLegName,
    updatedRoundings,
    newlyRounded,
  };
}

/**
 * Replays a batch of historical backfilled points (stored while offline or buffered via LoRa)
 * sequentially through the course rounding engine.
 * Ensures marks rounded while disconnected are detected and elapsed times remain accurate.
 */
export function replayBatchThroughCourseProgress(
  boat: Boat,
  marks: CourseMark[],
  points: BackfillPoint[],
  countdownSeconds: number
): Boat {
  if (!boat || !Array.isArray(points) || points.length === 0) return boat;

  let currentBoat: Boat = { ...boat };
  let prevLat = boat.lat;
  let prevLng = boat.lng;

  // Chronologically sort points by GNSS hardware atomic clock
  const sortedPoints = [...points].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  for (const pt of sortedPoints) {
    if (typeof pt.lat !== 'number' || typeof pt.lng !== 'number' || isNaN(pt.lat) || isNaN(pt.lng) || pt.lat === 0) {
      continue;
    }

    currentBoat.lat = pt.lat;
    currentBoat.lng = pt.lng;
    if (typeof pt.speedKt === 'number') currentBoat.sog = pt.speedKt;
    if (typeof pt.headingDeg === 'number') {
      currentBoat.cog = pt.headingDeg;
      currentBoat.heading = pt.headingDeg;
    }

    const evalResult = evaluateBoatCourseProgress(
      currentBoat,
      marks,
      countdownSeconds,
      prevLat,
      prevLng
    );

    currentBoat.dtw = evalResult.dtwNm;
    currentBoat.markRoundings = evalResult.updatedRoundings;
    if (evalResult.isFinished) {
      currentBoat.status = 'FINISHED';
    } else if (evalResult.isOcs && currentBoat.status !== 'CLEARED_OCS') {
      currentBoat.status = 'OCS';
    } else if (currentBoat.status === 'OCS' && !evalResult.isOcs) {
      currentBoat.status = 'RACING';
    }

    prevLat = pt.lat;
    prevLng = pt.lng;
  }

  return currentBoat;
}

/**
 * Creates preset course layouts (Windward-Leeward, Olympic Triangle, Trapezoid)
 * oriented along the True Wind Direction (TWD).
 */
export function generateCoursePreset(
  presetType: 'WINDWARD_LEEWARD' | 'TRIANGLE' | 'TRAPEZOID',
  centerLat: number,
  centerLng: number,
  twdDeg: number
): CourseMark[] {
  const safeCenterLat = typeof centerLat === 'number' && Number.isFinite(centerLat) ? centerLat : 6.308;
  const safeCenterLng = typeof centerLng === 'number' && Number.isFinite(centerLng) ? centerLng : 99.845;
  const safeTwd = typeof twdDeg === 'number' && Number.isFinite(twdDeg) ? twdDeg : 45;

  const windRad = ((safeTwd - 180) * Math.PI) / 180; // Wind blowing towards
  const perpRad = windRad + Math.PI / 2;

  const latScale = 0.015; // ~0.9 NM
  const lngScale = 0.022;

  // Start Line: perpendicular to wind
  const pinLat = safeCenterLat - Math.sin(perpRad) * 0.003;
  const pinLng = safeCenterLng - Math.cos(perpRad) * 0.005;
  const rcLat = safeCenterLat + Math.sin(perpRad) * 0.003;
  const rcLng = safeCenterLng + Math.cos(perpRad) * 0.005;

  const startPin: CourseMark = {
    id: 'pin-end',
    name: 'Start Pin End (Orange Buoy)',
    shortName: 'SP',
    type: 'PIN_END',
    lat: +pinLat.toFixed(6),
    lng: +pinLng.toFixed(6),
    radiusMeters: 30,
    requiredRounding: 'LINE',
    color: '#FF4D4D',
    orderIndex: 0,
  };

  const startRc: CourseMark = {
    id: 'rc-boat',
    name: 'RC Signal Vessel (Flagship)',
    shortName: 'RC',
    type: 'RC_BOAT',
    lat: +rcLat.toFixed(6),
    lng: +rcLng.toFixed(6),
    radiusMeters: 30,
    requiredRounding: 'LINE',
    color: '#00D4FF',
    orderIndex: 0,
  };

  // Mark 1: Direct Windward
  const m1Lat = safeCenterLat + Math.cos(windRad) * latScale;
  const m1Lng = safeCenterLng + Math.sin(windRad) * lngScale;

  const mark1: CourseMark = {
    id: 'mark-1',
    name: 'Mark 1 (Windward Top)',
    shortName: '1',
    type: 'WINDWARD',
    lat: +m1Lat.toFixed(6),
    lng: +m1Lng.toFixed(6),
    radiusMeters: 45,
    requiredRounding: 'PORT',
    color: '#FBBC04',
    orderIndex: 1,
  };

  if (presetType === 'WINDWARD_LEEWARD') {
    // Leeward Gate Mark 2
    const m2Lat = safeCenterLat - Math.cos(windRad) * (latScale * 0.7);
    const m2Lng = safeCenterLng - Math.sin(windRad) * (lngScale * 0.7);

    const mark2: CourseMark = {
      id: 'mark-2',
      name: 'Mark 2 (Leeward Gate)',
      shortName: '2',
      type: 'LEEWARD',
      lat: +m2Lat.toFixed(6),
      lng: +m2Lng.toFixed(6),
      radiusMeters: 45,
      requiredRounding: 'PORT',
      color: '#FBBC04',
      orderIndex: 2,
    };

    const finishPin: CourseMark = {
      id: 'finish-pin',
      name: 'Finish Pin (Chequered Buoy)',
      shortName: 'FP',
      type: 'FINISH_PIN',
      lat: +(m1Lat + 0.001).toFixed(6),
      lng: +(m1Lng - 0.002).toFixed(6),
      radiusMeters: 35,
      requiredRounding: 'LINE',
      color: '#00FF9D',
      orderIndex: 999,
    };

    return [startPin, startRc, mark1, mark2, finishPin];
  }

  if (presetType === 'TRIANGLE') {
    // Wing mark offset by 45 degrees
    const wingRad = windRad + (Math.PI * 3) / 4;
    const m2Lat = safeCenterLat + Math.cos(wingRad) * (latScale * 0.8);
    const m2Lng = safeCenterLng + Math.sin(wingRad) * (lngScale * 0.8);

    const mark2: CourseMark = {
      id: 'mark-2',
      name: 'Mark 2 (Jibe Wing)',
      shortName: '2',
      type: 'WING',
      lat: +m2Lat.toFixed(6),
      lng: +m2Lng.toFixed(6),
      radiusMeters: 45,
      requiredRounding: 'PORT',
      color: '#FBBC04',
      orderIndex: 2,
    };

    // Leeward mark 3
    const m3Lat = safeCenterLat - Math.cos(windRad) * (latScale * 0.6);
    const m3Lng = safeCenterLng - Math.sin(windRad) * (lngScale * 0.6);

    const mark3: CourseMark = {
      id: 'mark-3',
      name: 'Mark 3 (Leeward)',
      shortName: '3',
      type: 'LEEWARD',
      lat: +m3Lat.toFixed(6),
      lng: +m3Lng.toFixed(6),
      radiusMeters: 45,
      requiredRounding: 'PORT',
      color: '#FBBC04',
      orderIndex: 3,
    };

    const finishPin: CourseMark = {
      id: 'finish-pin',
      name: 'Finish Line Pin',
      shortName: 'FP',
      type: 'FINISH_PIN',
      lat: +(safeCenterLat + 0.002).toFixed(6),
      lng: +(safeCenterLng - 0.003).toFixed(6),
      radiusMeters: 35,
      requiredRounding: 'LINE',
      color: '#00FF9D',
      orderIndex: 999,
    };

    return [startPin, startRc, mark1, mark2, mark3, finishPin];
  }

  // Trapezoid (4 marks)
  const m2Lat = m1Lat + Math.sin(perpRad) * 0.006;
  const m2Lng = m1Lng + Math.cos(perpRad) * 0.009;

  const mark2: CourseMark = {
    id: 'mark-2',
    name: 'Mark 2 (Reach Spreader)',
    shortName: '2',
    type: 'WING',
    lat: +m2Lat.toFixed(6),
    lng: +m2Lng.toFixed(6),
    radiusMeters: 45,
    requiredRounding: 'PORT',
    color: '#FBBC04',
    orderIndex: 2,
  };

  const m3Lat = m2Lat - Math.cos(windRad) * (latScale * 0.9);
  const m3Lng = m2Lng - Math.sin(windRad) * (lngScale * 0.9);

  const mark3: CourseMark = {
    id: 'mark-3',
    name: 'Mark 3 (Outer Leeward)',
    shortName: '3',
    type: 'LEEWARD',
    lat: +m3Lat.toFixed(6),
    lng: +m3Lng.toFixed(6),
    radiusMeters: 45,
    requiredRounding: 'PORT',
    color: '#FBBC04',
    orderIndex: 3,
  };

  const m4Lat = safeCenterLat - Math.cos(windRad) * (latScale * 0.7);
  const m4Lng = safeCenterLng - Math.sin(windRad) * (lngScale * 0.7);

  const mark4: CourseMark = {
    id: 'mark-4',
    name: 'Mark 4 (Inner Gate)',
    shortName: '4',
    type: 'GATE',
    lat: +m4Lat.toFixed(6),
    lng: +m4Lng.toFixed(6),
    radiusMeters: 45,
    requiredRounding: 'PORT',
    color: '#FBBC04',
    orderIndex: 4,
  };

  const finishPin: CourseMark = {
    id: 'finish-pin',
    name: 'Finish Line Pin',
    shortName: 'FP',
    type: 'FINISH_PIN',
    lat: +(safeCenterLat + 0.002).toFixed(6),
    lng: +(safeCenterLng - 0.003).toFixed(6),
    radiusMeters: 35,
    requiredRounding: 'LINE',
    color: '#00FF9D',
    orderIndex: 999,
  };

  return [startPin, startRc, mark1, mark2, mark3, mark4, finishPin];
}
