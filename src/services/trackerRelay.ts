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

/**
 * A fix older than this is not shared or scored. On connect a radio hands over its whole NodeDB,
 * including positions it heard hours ago; those must not show as live or move a boat. 15 min is
 * Meshtastic's default position interval, so a tracker on default settings always passes.
 */
export const MAX_FIX_AGE_MS = 15 * 60_000;
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
export function createTrackerRelayGate(opts: { relayIntervalMs?: number; maxFixAgeMs?: number; now?: () => number } = {}) {
  const relayIntervalMs = opts.relayIntervalMs ?? 60_000;
  const maxFixAgeMs = opts.maxFixAgeMs ?? MAX_FIX_AGE_MS;
  const now = opts.now ?? Date.now;
  const lastFix = new Map<string, string>();
  const lastRelay = new Map<string, { at: number; boatId: string }>();

  return {
    decide(node: MeshtasticNode, boats: Boat[]): TrackerRelayDecision {
      if (!isNum(node.lat) || !isNum(node.lng) || (node.lat === 0 && node.lng === 0)) return NONE;
      // The node's own binding wins; a boat still naming the node (a stale nodeId) is only the fallback
      const boat = (node.boundBoatId ? boats.find((b) => b.id === node.boundBoatId) : undefined)
        ?? boats.find((b) => sameNodeId(b.nodeId, node.id));
      if (!boat) return NONE;

      const t = now();
      const fixTime = node.positionTime ?? node.lastPingTime;
      if (!isNum(fixTime) || t - fixTime > maxFixAgeMs) return NONE;

      const id = canonicalNodeId(node.id);
      const fixKey = `${node.lat},${node.lng},${isNum(node.speedKt) ? node.speedKt : ''}`;
      const applyFix = lastFix.get(id) !== fixKey;
      if (applyFix) lastFix.set(id, fixKey);

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
