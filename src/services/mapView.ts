// Lets panels outside the map (Race Officer console, course profiles) ask where the map
// is looking and move it to the course. App can mount two maps (desktop and phone layouts),
// and on a phone the map is unmounted while the console tab is open, so this keeps the
// last centre seen and a pending fit that the next visible map picks up.

export interface LatLng {
  lat: number;
  lng: number;
}

export interface MapViewHandle {
  isVisible: () => boolean;
  getCenter: () => LatLng | null;
  fitTo: (points: LatLng[]) => void;
}

const maps = new Set<MapViewHandle>();
let lastCenter: LatLng | null = null;
let pendingFit: LatLng[] | null = null;

const isFiniteCoord = (p: LatLng | null | undefined): p is LatLng =>
  !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;

const visibleMap = (): MapViewHandle | undefined => [...maps].find((m) => m.isVisible());

export function registerMapView(handle: MapViewHandle): () => void {
  maps.add(handle);
  return () => {
    const c = handle.getCenter();
    if (isFiniteCoord(c)) lastCenter = c;
    maps.delete(handle);
  };
}

/** Call when a map's view settles, so the centre survives the map unmounting. */
export function noteMapCenter(center: LatLng | null): void {
  if (isFiniteCoord(center)) lastCenter = center;
}

/** Centre of the map the user is looking at, or the last one they saw; null before any map has shown. */
export function getMapCenter(): LatLng | null {
  const c = visibleMap()?.getCenter();
  if (isFiniteCoord(c)) return c;
  return lastCenter;
}

/** Fit the visible map to these points; with no map on screen, the next map that shows does it. */
export function fitMapTo(points: LatLng[]): void {
  const valid = points.filter(isFiniteCoord);
  if (valid.length === 0) return;
  const map = visibleMap();
  if (map) {
    pendingFit = null;
    map.fitTo(valid);
  } else {
    pendingFit = valid;
  }
}

/** For a map that just became visible: the fit it owes, if any. */
export function takePendingFit(): LatLng[] | null {
  const p = pendingFit;
  pendingFit = null;
  return p;
}
