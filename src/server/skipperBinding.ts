// Skippers connecting their own tracker, when the race office allows it.
//
// The race office binds trackers by sending the whole fleet (UPDATE_BOATS), which only editors may
// do. A skipper instead asks for one binding, and the server checks it here: the option must be on,
// the tracker must be a Meshtastic node no other boat uses, and the boat must have no tracker yet.
// A skipper can't replace or remove a tracker, so they can't take another boat off the map; the
// race office still does those.
import { canonicalNodeId, nodeNumFromId, sameNodeId } from '../utils/nodeId';

export type SkipperBindRejection =
  | 'DISABLED'
  | 'NOT_PARTICIPANT'
  | 'BAD_REQUEST'
  | 'NOT_A_TRACKER'
  | 'NO_SUCH_BOAT'
  | 'BOAT_HAS_TRACKER'
  | 'TRACKER_IN_USE';

export type SkipperBindDecision<B> =
  | { ok: true; boats: B[]; boatId: string; nodeId: string; changed: boolean }
  | { ok: false; reason: SkipperBindRejection };

interface BindableBoat {
  id: string;
  nodeId?: string | null;
}

/** Whether the race office has turned the option on for this room */
export function skipperConnectEnabled(raceState: unknown): boolean {
  return !!raceState && typeof raceState === 'object' && (raceState as any).skipperConnectEnabled === true;
}

/**
 * Checks a skipper's request to bind `nodeId` to `boatId`. Returns the fleet with the binding
 * applied, or why it was refused. `role` is the socket's room role; editors are let through so the
 * same path works for them, though their app uses UPDATE_BOATS.
 */
export function decideSkipperBinding<B extends BindableBoat>(
  boats: B[],
  raceState: unknown,
  role: string,
  request: unknown
): SkipperBindDecision<B> {
  const isEditor = role === 'ADMIN' || role === 'RACE_OFFICER';
  if (!isEditor && role !== 'PARTICIPANT') return { ok: false, reason: 'NOT_PARTICIPANT' };
  if (!isEditor && !skipperConnectEnabled(raceState)) return { ok: false, reason: 'DISABLED' };

  const boatId = (request as any)?.boatId;
  const rawNodeId = (request as any)?.nodeId;
  if (typeof boatId !== 'string' || !boatId || typeof rawNodeId !== 'string' || !rawNodeId) {
    return { ok: false, reason: 'BAD_REQUEST' };
  }
  // A phone shares its position with Track; only radio trackers are bound this way
  if (nodeNumFromId(rawNodeId) === null) return { ok: false, reason: 'NOT_A_TRACKER' };
  const nodeId = canonicalNodeId(rawNodeId);

  const list = Array.isArray(boats) ? boats : [];
  const boat = list.find((b) => b && b.id === boatId);
  if (!boat) return { ok: false, reason: 'NO_SUCH_BOAT' };

  // Asking again for the binding that's already there is fine
  if (sameNodeId(boat.nodeId, nodeId)) return { ok: true, boats: list, boatId, nodeId, changed: false };
  if (boat.nodeId) return { ok: false, reason: 'BOAT_HAS_TRACKER' };
  if (list.some((b) => b && b.id !== boatId && sameNodeId(b.nodeId, nodeId))) {
    return { ok: false, reason: 'TRACKER_IN_USE' };
  }

  return {
    ok: true,
    boats: list.map((b) => (b.id === boatId ? { ...b, nodeId } : b)),
    boatId,
    nodeId,
    changed: true,
  };
}

/** What the skipper sees when a request is refused */
export const SKIPPER_BIND_MESSAGES: Record<SkipperBindRejection, string> = {
  DISABLED: 'The race office has not allowed skippers to connect trackers in this event.',
  NOT_PARTICIPANT: 'Unlock with the skipper PIN to connect a tracker.',
  BAD_REQUEST: 'Choose a tracker and a boat.',
  NOT_A_TRACKER: 'Only a Meshtastic tracker can be connected here. Use Track in the header to share this phone’s position.',
  NO_SUCH_BOAT: 'That boat is no longer in the fleet.',
  BOAT_HAS_TRACKER: 'That boat already has a tracker. Ask the race office to change it.',
  TRACKER_IN_USE: 'That tracker is on another boat. Ask the race office to move it.',
};
