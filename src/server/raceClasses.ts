// Race classes stored on a room. Every device in the room gets them from the server, so they are
// checked here before they are kept: the payload comes from a browser.

export interface StoredRaceClass {
  id: string;
  name: string;
  description?: string;
  ratingSystem?: 'IRC' | 'ORC' | 'PY';
  defaultRating?: number;
  color?: string;
  courseProfileId?: string;
  courseProfileName?: string;
}

export const MAX_RACE_CLASSES = 50;
const MAX_ID = 64;
const MAX_NAME = 60;
const MAX_TEXT = 200;
const RATING_SYSTEMS = new Set(['IRC', 'ORC', 'PY']);

function text(v: unknown, max: number): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : undefined;
}

/**
 * Returns a clean class list, or null when the payload can't be a room's classes (not an array,
 * empty, too long, or no usable class in it). Items without an id or name are dropped, duplicate
 * ids keep the first, and unknown fields are left out.
 */
export function sanitizeRaceClasses(input: unknown): StoredRaceClass[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_RACE_CLASSES) return null;
  const seen = new Set<string>();
  const out: StoredRaceClass[] = [];
  for (const item of input) {
    if (!item || typeof item !== 'object') continue;
    const v = item as Record<string, unknown>;
    const id = text(v.id, MAX_ID);
    const name = text(v.name, MAX_NAME);
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    const cls: StoredRaceClass = { id, name };
    const description = text(v.description, MAX_TEXT);
    if (description) cls.description = description;
    if (typeof v.ratingSystem === 'string' && RATING_SYSTEMS.has(v.ratingSystem)) {
      cls.ratingSystem = v.ratingSystem as StoredRaceClass['ratingSystem'];
    }
    if (typeof v.defaultRating === 'number' && Number.isFinite(v.defaultRating) && v.defaultRating > 0) {
      cls.defaultRating = v.defaultRating;
    }
    const color = text(v.color, 32);
    if (color) cls.color = color;
    const courseProfileId = text(v.courseProfileId, MAX_ID);
    if (courseProfileId) cls.courseProfileId = courseProfileId;
    const courseProfileName = text(v.courseProfileName, MAX_TEXT);
    if (courseProfileName) cls.courseProfileName = courseProfileName;
    out.push(cls);
  }
  return out.length > 0 ? out : null;
}

/** Reads the events.race_classes_json column. null means the room has no classes set yet. */
export function parseStoredRaceClasses(raw: string | null | undefined): StoredRaceClass[] | null {
  if (!raw) return null;
  try {
    return sanitizeRaceClasses(JSON.parse(raw));
  } catch {
    return null;
  }
}
