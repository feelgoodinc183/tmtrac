/**
 * Meshtastic node ids are a 32-bit node number, written as "!" plus 8 lowercase hex digits
 * (e.g. "!a1b2c3d4"). BLE, MQTT, bindings and the UI must all use this one form, otherwise the
 * same tracker shows up as several nodes.
 *
 * Accepts a node number, or a string such as "!A1B2C3D4", "a1b2c3d4", "0xa1b2c3d4" or "!b2c3d4".
 * Ids that are not Meshtastic node numbers (e.g. a phone's "!DEV-1A2B") are returned trimmed
 * and otherwise unchanged.
 */
export function canonicalNodeId(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return '';
    return `!${(raw >>> 0).toString(16).padStart(8, '0')}`;
  }
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const hex = trimmed.replace(/^!/, '').replace(/^0x/i, '');
  if (/^[0-9a-f]{1,8}$/i.test(hex)) {
    return `!${hex.toLowerCase().padStart(8, '0')}`;
  }
  return trimmed;
}

/** True when both ids name the same node, whatever case or prefix each was written with. */
export function sameNodeId(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return canonicalNodeId(a) === canonicalNodeId(b);
}

/** Meshtastic node number for an id, or null if the id is not a Meshtastic node number. */
export function nodeNumFromId(id: string | null | undefined): number | null {
  const canon = canonicalNodeId(id);
  if (!/^![0-9a-f]{8}$/.test(canon)) return null;
  return parseInt(canon.slice(1), 16) >>> 0;
}
