// A batch of stored positions from one tracker (a phone or relayed LoRa tracker coming back
// online, or the Android app's store-and-forward). Used by the WebSocket and the HTTP route.

export interface BatchPoint {
  lat: number;
  lng: number;
  timestamp?: number;
  speedKt?: number;
  headingDeg?: number;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * The tracker and fleet after a batch. Points join the trails in time order. The tracker and its
 * bound boat only move when the batch's newest fix is newer than the last one the room has, so a
 * backlog that arrives late never pulls a boat back to where it was minutes ago.
 */
export function applyGpsBatch<B extends { id: string; lat?: number; lng?: number; trail?: any[] }>(
  existing: Record<string, any>,
  boats: B[],
  boundBoatId: string | null | undefined,
  payload: { points: BatchPoint[] } & Record<string, any>,
  now: number
): { tracker: Record<string, any>; boats: B[]; moved: boolean; boatChanged: boolean } {
  const points = (payload.points || [])
    .filter((p) => p && isNum(p.lat) && isNum(p.lng) && !(p.lat === 0 && p.lng === 0))
    .slice()
    .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
  const coords = points.map((p) => ({ lat: p.lat, lng: p.lng }));
  const newest = points[points.length - 1];
  const lastFix: number | undefined = isNum(existing.fixTime) ? existing.fixTime : undefined;
  const newestAt = newest && isNum(newest.timestamp) ? newest.timestamp : undefined;
  const moved = !!newest && (lastFix === undefined || newestAt === undefined || newestAt >= lastFix);

  const tracker: Record<string, any> = {
    ...existing,
    ...payload,
    trail: [...(existing.trail || []), ...coords].slice(-2000),
    lastSeen: now,
    isOnline: true,
  };
  delete tracker.points;
  if (moved) {
    tracker.lat = newest.lat;
    tracker.lng = newest.lng;
    tracker.speedKt = newest.speedKt ?? existing.speedKt ?? 0;
    tracker.headingDeg = newest.headingDeg ?? existing.headingDeg ?? 0;
    if (newestAt !== undefined) tracker.fixTime = newestAt;
  } else {
    // Keep the newer position the room already has
    for (const k of ['lat', 'lng', 'speedKt', 'headingDeg', 'fixTime']) {
      if (k in existing) tracker[k] = existing[k];
      else delete tracker[k];
    }
  }

  let boatChanged = false;
  const nextBoats = !boundBoatId || !Array.isArray(boats)
    ? boats
    : boats.map((b) => {
        // Only the bound boat: another boat still naming this tracker (a stale nodeId) stays put
        if (b.id !== boundBoatId || coords.length === 0) return b;
        boatChanged = true;
        const trail = [...(b.trail || []), ...coords].slice(-2000);
        if (!moved) return { ...b, trail };
        return {
          ...b,
          lat: newest.lat,
          lng: newest.lng,
          sog: newest.speedKt ?? (b as any).sog,
          cog: newest.headingDeg ?? (b as any).cog,
          heading: newest.headingDeg ?? (b as any).heading,
          trail,
        };
      });

  return { tracker, boats: nextBoats, moved, boatChanged };
}
