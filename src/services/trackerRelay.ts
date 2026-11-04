import { Boat, MeshtasticNode } from '../types/regatta';
import { canonicalNodeId, sameNodeId } from '../utils/nodeId';

export interface TrackerRelayDecision {
  /** Boat in this room the tracker is bound to, or null (then nothing is shared or scored) */
  boundBoatId: string | null;
  /** Send the tracker to the room now */
  relay: boolean;
  /** The fix is new (position or speed changed): add it to the boat's trail and score it */
  applyFix: boolean;
}

const NONE: TrackerRelayDecision = { boundBoatId: null, relay: false, applyFix: false };
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Decides, for each update from a LoRa tracker, whether to share it with the room and whether to
 * apply it to the bound boat.
 *
 * - The binding is checked first. Only trackers bound to a boat in this room are shared.
 * - A repeated fix (same position and speed) isn't added to the trail or scored again, but the
 *   tracker is still shared at least every `relayIntervalMs`, so a boat sitting still on its
 *   mooring stays "live" for spectators instead of being pruned by the server.
 * - A change of boat is shared at once.
 * - `forget` is called when a tracker is bound, unbound or deleted, so its next update counts as new.
 */
export function createTrackerRelayGate(opts: { relayIntervalMs?: number; now?: () => number } = {}) {
  const relayIntervalMs = opts.relayIntervalMs ?? 60_000;
  const now = opts.now ?? Date.now;
  const lastFix = new Map<string, string>();
  const lastRelay = new Map<string, { at: number; boatId: string }>();

  return {
    decide(node: MeshtasticNode, boats: Boat[]): TrackerRelayDecision {
      if (!isNum(node.lat) || !isNum(node.lng) || (node.lat === 0 && node.lng === 0)) return NONE;
      const boat = boats.find((b) => (node.boundBoatId && b.id === node.boundBoatId) || sameNodeId(b.nodeId, node.id));
      if (!boat) return NONE;

      const id = canonicalNodeId(node.id);
      const fixKey = `${node.lat},${node.lng},${isNum(node.speedKt) ? node.speedKt : ''}`;
      const applyFix = lastFix.get(id) !== fixKey;
      if (applyFix) lastFix.set(id, fixKey);

      const t = now();
      const prev = lastRelay.get(id);
      const relay = applyFix || !prev || prev.boatId !== boat.id || t - prev.at >= relayIntervalMs;
      if (relay) lastRelay.set(id, { at: t, boatId: boat.id });

      return { boundBoatId: boat.id, relay, applyFix };
    },

    forget(nodeId: string) {
      const id = canonicalNodeId(nodeId);
      lastFix.delete(id);
      lastRelay.delete(id);
    },
  };
}
