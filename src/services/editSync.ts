// Room edits made while the server can't be reached: kept on the device, then merged with the
// server's state and sent when the connection is back.
//
// Each room edit sends the whole of one part of the room (the fleet, the marks, ...). So for each
// part this keeps the latest unsent value and the server's value it was based on. On reconnect a
// three-way merge decides, item by item, whose change wins: an item only this device changed takes
// this device's version; an item both changed keeps the server's (another device got there first)
// and is reported. Race settings carry a time, and the later change wins, as on the server.
import { Boat, CompletedRace, CourseMark, RaceClassDefinition, RaceState, VhfBulletin } from '../types/regatta';

export type EditChannel = 'boats' | 'marks' | 'raceState' | 'classes' | 'series';
export const EDIT_CHANNELS: EditChannel[] = ['boats', 'marks', 'raceState', 'classes', 'series'];

/** Where each part sits in the server's session state */
export const SESSION_KEY: Record<EditChannel, string> = {
  boats: 'boats',
  marks: 'marks',
  raceState: 'raceState',
  classes: 'raceClasses',
  series: 'seriesRaces',
};

/** What a person calls each part, for "changed on another device" */
const CHANNEL_LABEL: Record<EditChannel, string> = {
  boats: 'Fleet',
  marks: 'Course marks',
  raceState: 'Race settings',
  classes: 'Classes',
  series: 'Series results',
};

interface Pending {
  payload: any;
  /** The server's value this device last knew before the first unsent change */
  base: any;
}

interface Sent extends Pending {
  at: number;
}

export interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Fields that change on every position report; a boat moving is not an edit */
const BOAT_LIVE_FIELDS = new Set([
  'lat', 'lng', 'sog', 'cog', 'vmg', 'dtw', 'heading', 'headingDeg', 'speedKt', 'rank', 'tack',
  'trail', 'elapsedSeconds', 'correctedSeconds', 'markRoundings', 'markSplits',
]);

function stableJson(value: unknown, skip?: Set<string>): string {
  const norm = (v: any): any => {
    if (Array.isArray(v)) return v.map(norm);
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      Object.keys(v)
        .filter((k) => v[k] !== undefined && !(skip && skip.has(k)))
        .sort()
        .forEach((k) => (out[k] = norm(v[k])));
      return out;
    }
    return v;
  };
  return JSON.stringify(norm(value));
}

/** What counts as a change to one item of a part */
const ITEM_KEY: Record<Exclude<EditChannel, 'raceState'>, (item: any) => string> = {
  boats: (b: Boat) => stableJson(b, BOAT_LIVE_FIELDS),
  marks: (m: CourseMark) => stableJson(m),
  classes: (c: RaceClassDefinition) => stableJson(c),
  series: (r: CompletedRace) => stableJson(r),
};

const itemName = (channel: EditChannel, item: any): string => {
  if (!item) return CHANNEL_LABEL[channel];
  if (channel === 'boats') return item.sailNumber || item.name || 'a boat';
  if (channel === 'marks') return item.name || item.shortName || 'a mark';
  if (channel === 'classes') return item.name || 'a class';
  if (channel === 'series') return item.raceTitle || `Race ${item.raceNumber ?? ''}`.trim();
  return CHANNEL_LABEL[channel];
};

/** Three-way merge of one item's fields. Live position fields always come from the server. */
function mergeFields(channel: EditChannel, base: any, ours: any, theirs: any): { merged: any; clash: boolean; oursUsed: boolean } {
  const merged: Record<string, unknown> = { ...theirs };
  let clash = false;
  let oursUsed = false;
  const eq = (a: unknown, b: unknown) => stableJson(a) === stableJson(b);
  for (const k of new Set([...Object.keys(base), ...Object.keys(ours), ...Object.keys(theirs)])) {
    if (channel === 'boats' && BOAT_LIVE_FIELDS.has(k)) continue;
    if (eq(ours[k], base[k]) || eq(ours[k], theirs[k])) continue;
    if (eq(theirs[k], base[k])) {
      if (ours[k] === undefined) delete merged[k];
      else merged[k] = ours[k];
      oursUsed = true;
    } else {
      clash = true; // both changed this field: the server's value stays
    }
  }
  return { merged, clash, oursUsed };
}

export interface MergeResult<T> {
  merged: T;
  /** Items both sides changed, where the server's version was kept */
  conflicts: string[];
  /** This device's changes made it into the merge, so it must be sent */
  changed: boolean;
}

/**
 * Three-way merge of a list by item id. `base` is what this device last knew from the server,
 * `ours` its unsent version, `theirs` the server's version now.
 */
export function mergeList<T extends { id: string }>(
  channel: Exclude<EditChannel, 'raceState'>,
  base: T[] | null | undefined,
  ours: T[] | null | undefined,
  theirs: T[] | null | undefined
): MergeResult<T[]> {
  const key = ITEM_KEY[channel];
  const b = new Map((base || []).filter(Boolean).map((x) => [x.id, x]));
  const o = new Map((ours || []).filter(Boolean).map((x) => [x.id, x]));
  const t = new Map((theirs || []).filter(Boolean).map((x) => [x.id, x]));
  const same = (x: T | undefined, y: T | undefined) => (x === undefined || y === undefined ? x === y : key(x) === key(y));

  const result = new Map(t);
  const conflicts: string[] = [];
  let changed = false;

  const ids = new Set([...b.keys(), ...o.keys()]);
  for (const id of ids) {
    const bo = b.get(id);
    const ou = o.get(id);
    const th = t.get(id);
    if (same(bo, ou)) continue; // this device didn't change it
    if (same(ou, th)) continue; // both made the same change
    if (same(bo, th)) {
      // Only this device changed it: take this device's version (or its deletion)
      if (ou === undefined) result.delete(id);
      else result.set(id, ou);
      changed = true;
    } else if (bo && ou && th) {
      // Both changed it: field by field, a field only one side changed takes that side's value
      const f = mergeFields(channel, bo, ou, th);
      result.set(id, f.merged as T);
      if (f.oursUsed) changed = true;
      if (f.clash) conflicts.push(itemName(channel, th));
    } else {
      // Added on both sides with the same id, or deleted on one side and changed on the other
      conflicts.push(itemName(channel, th || ou || bo));
    }
  }

  // Keep the server's order, then items this device added
  const order = [...(theirs || []).map((x) => x?.id), ...(ours || []).map((x) => x?.id)];
  const seen = new Set<string>();
  const merged: T[] = [];
  for (const id of order) {
    if (!id || seen.has(id) || !result.has(id)) continue;
    seen.add(id);
    merged.push(result.get(id)!);
  }
  return { merged, conflicts, changed };
}

/** Race settings: the later change wins, as the server decides for live edits */
export function mergeRaceState(
  ours: Partial<RaceState>,
  theirs: Partial<RaceState> | null | undefined
): MergeResult<Partial<RaceState>> {
  const mine = ours?.updatedAt ?? 0;
  const server = theirs?.updatedAt ?? 0;
  if (mine > server) return { merged: { ...(theirs || {}), ...ours }, conflicts: [], changed: true };
  const differs = stableJson({ ...(theirs || {}), ...ours }) !== stableJson(theirs || {});
  return { merged: theirs || {}, conflicts: differs ? [CHANNEL_LABEL.raceState] : [], changed: false };
}

export interface Reconciled {
  /** The session state to show: the server's, with this device's unsent changes merged in */
  session: Record<string, any>;
  /** What to send to the server now (only when this device may edit) */
  toSend: { channel: EditChannel; payload: any }[];
  /** VHF notices that never went out */
  notices: VhfBulletin[];
  /** Things another device changed too, where its version was kept */
  conflicts: string[];
  /** Changes held because this device may not edit the room right now */
  held: boolean;
}

/**
 * The unsent changes of one device, for the room it is in. Storage keeps them through a reload.
 */
export function createEditSync(opts: { storage?: Storage | null; now?: () => number } = {}) {
  const now = opts.now ?? Date.now;
  let room = '';
  const known: Partial<Record<EditChannel, any>> = {};
  let pending: Partial<Record<EditChannel, Pending>> = {};
  const sent: Partial<Record<EditChannel, Sent>> = {};
  let notices: VhfBulletin[] = [];
  let sentNotices: { notice: VhfBulletin; at: number }[] = [];
  const listeners = new Set<() => void>();

  const storageKey = () => `tmtrac_pending_edits_${room}`;
  const persist = () => {
    if (!opts.storage || !room) return;
    try {
      if (Object.keys(pending).length === 0 && notices.length === 0) opts.storage.removeItem(storageKey());
      else opts.storage.setItem(storageKey(), JSON.stringify({ pending, notices }));
    } catch {
      // Kept in memory; lost only if the page is closed before the connection is back
    }
  };
  const load = () => {
    pending = {};
    notices = [];
    if (!opts.storage || !room) return;
    try {
      const raw = opts.storage.getItem(storageKey());
      if (!raw) return;
      const v = JSON.parse(raw);
      if (v && typeof v === 'object') {
        if (v.pending && typeof v.pending === 'object') pending = v.pending;
        if (Array.isArray(v.notices)) notices = v.notices;
      }
    } catch {}
  };
  const changed = () => {
    persist();
    listeners.forEach((cb) => cb());
  };

  return {
    /** The room these changes belong to; switching loads that room's unsent changes */
    setRoom(code: string) {
      if (code === room) return;
      room = code;
      for (const c of EDIT_CHANNELS) {
        delete known[c];
        delete sent[c];
      }
      sentNotices = [];
      load();
      listeners.forEach((cb) => cb());
    },

    /** How many changes are waiting to be sent */
    count(): number {
      return Object.keys(pending).length + notices.length;
    },

    hasPending(channel: EditChannel): boolean {
      return !!pending[channel];
    },

    /**
     * The kept changes as session state (each is a whole part of the room), for a page that has
     * reloaded before the server could be reached; null when nothing is kept.
     */
    pendingSession(): Record<string, any> | null {
      const out: Record<string, any> = {};
      for (const c of EDIT_CHANNELS) if (pending[c]) out[SESSION_KEY[c]] = pending[c]!.payload;
      return Object.keys(out).length ? out : null;
    },

    subscribe(cb: () => void): () => void {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },

    /** A value the server sent: the starting point for the next unsent change */
    noteServer(channel: EditChannel, value: any) {
      known[channel] = value;
    },

    /** Sent on the live connection; it may still be lost if the connection was already dead */
    noteSent(channel: EditChannel, payload: any) {
      sent[channel] = { payload, base: pending[channel]?.base ?? known[channel], at: now() };
      known[channel] = payload;
    },

    noteNoticeSent(notice: VhfBulletin) {
      sentNotices = [...sentNotices.filter((s) => now() - s.at < 120_000), { notice, at: now() }];
    },

    /** Couldn't be sent: keep the latest value, based on what the server last had */
    queue(channel: EditChannel, payload: any) {
      pending[channel] = { payload, base: pending[channel] ? pending[channel]!.base : known[channel] };
      changed();
    },

    queueNotice(notice: VhfBulletin) {
      if (!notices.some((n) => n.id === notice.id)) notices = [...notices, notice];
      changed();
    },

    /**
     * The connection closed. Anything sent after the last message heard from the server may not
     * have arrived: keep it to send again (sending it twice changes nothing).
     */
    connectionLost(lastHeardAt: number) {
      let any = false;
      for (const c of EDIT_CHANNELS) {
        const s = sent[c];
        if (s && s.at >= lastHeardAt) {
          pending[c] = { payload: pending[c]?.payload ?? s.payload, base: s.base };
          any = true;
        }
        delete sent[c];
      }
      for (const s of sentNotices) {
        if (s.at >= lastHeardAt && !notices.some((n) => n.id === s.notice.id)) {
          notices = [...notices, s.notice];
          any = true;
        }
      }
      sentNotices = [];
      if (any) changed();
    },

    /**
     * The server sent the room's state (a connect or a rejoin). Merges the unsent changes into it.
     * With `canEdit`, the merged changes are handed back to send and forgotten here; without it
     * they are shown but kept, since the server would refuse them.
     */
    reconcile(session: Record<string, any>, canEdit: boolean): Reconciled {
      const out = { ...session };
      const toSend: Reconciled['toSend'] = [];
      const conflicts: string[] = [];
      const sentNow = canEdit ? notices.filter((n) => !(session.vhfBulletins || []).some((b: VhfBulletin) => b?.id === n.id)) : [];

      for (const c of EDIT_CHANNELS) {
        const p = pending[c];
        const k = SESSION_KEY[c];
        if (!p || !(k in session)) continue;
        const theirs = session[k];
        const r =
          c === 'raceState'
            ? mergeRaceState(p.payload, theirs)
            : mergeList(c, p.base, p.payload, theirs);
        out[k] = r.merged;
        if (canEdit) {
          conflicts.push(...r.conflicts);
          if (r.changed) toSend.push({ channel: c, payload: r.merged });
          delete pending[c];
          known[c] = r.merged;
        }
      }
      if (canEdit) {
        notices = [];
        changed();
      }
      return { session: out, toSend, notices: sentNow, conflicts, held: !canEdit && this.count() > 0 };
    },
  };
}

export type EditSync = ReturnType<typeof createEditSync>;
