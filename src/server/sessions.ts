import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { db, dbDiagnosticsState, generateToken } from './db';

/**
 * Login sessions: one row per signed-in device, so signing in on a phone no longer signs the
 * same account out on a laptop. Tokens are stored hashed. Sessions expire after SESSION_TTL_MS
 * of inactivity.
 *
 * With SQLite this uses the user_sessions table. In JSON-store fallback mode (no SQLite driver)
 * it keeps the same records in sessions.json next to the store, so the SQL emulator in db.ts
 * does not need to learn new queries.
 *
 * Tokens issued before sessions existed live in users.token; findActiveUserByToken still accepts
 * them and moves them into a session on first use.
 */

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
// Only write last-seen / expiry updates this often, not on every request.
const TOUCH_INTERVAL_MS = 60 * 60 * 1000;

interface SessionRecord {
  token_hash: string;
  user_id: string;
  created_at: number;
  last_seen_at: number;
  expires_at: number;
  user_agent: string | null;
}

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

// ---------- storage backends ----------

let sqlReady = false;
function ensureSqlTable() {
  if (sqlReady) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      user_agent TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
  `);
  sqlReady = true;
}

const jsonPath = () => path.join(path.dirname(dbDiagnosticsState.fallbackStorePath), 'sessions.json');

function readJson(): Record<string, SessionRecord> {
  try {
    return JSON.parse(fs.readFileSync(jsonPath(), 'utf-8')) || {};
  } catch {
    return {};
  }
}

function writeJson(all: Record<string, SessionRecord>) {
  const target = jsonPath();
  const tmp = `${target}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(all), { encoding: 'utf-8', mode: 0o600 });
  fs.renameSync(tmp, target);
}

const useSql = () => dbDiagnosticsState.isNative;

function insertRecord(rec: SessionRecord) {
  if (useSql()) {
    ensureSqlTable();
    db.prepare(
      'INSERT OR REPLACE INTO user_sessions (token_hash, user_id, created_at, last_seen_at, expires_at, user_agent) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(rec.token_hash, rec.user_id, rec.created_at, rec.last_seen_at, rec.expires_at, rec.user_agent);
  } else {
    const all = readJson();
    all[rec.token_hash] = rec;
    writeJson(all);
  }
}

function getRecord(tokenHash: string): SessionRecord | null {
  if (useSql()) {
    ensureSqlTable();
    return (db.prepare('SELECT * FROM user_sessions WHERE token_hash = ?').get(tokenHash) as SessionRecord) || null;
  }
  return readJson()[tokenHash] || null;
}

function touchRecord(tokenHash: string, now: number) {
  const expires = now + SESSION_TTL_MS;
  if (useSql()) {
    db.prepare('UPDATE user_sessions SET last_seen_at = ?, expires_at = ? WHERE token_hash = ?').run(now, expires, tokenHash);
  } else {
    const all = readJson();
    if (all[tokenHash]) {
      all[tokenHash].last_seen_at = now;
      all[tokenHash].expires_at = expires;
      writeJson(all);
    }
  }
}

function deleteRecord(tokenHash: string) {
  if (useSql()) {
    ensureSqlTable();
    db.prepare('DELETE FROM user_sessions WHERE token_hash = ?').run(tokenHash);
  } else {
    const all = readJson();
    if (all[tokenHash]) {
      delete all[tokenHash];
      writeJson(all);
    }
  }
}

function deleteRecordsForUser(userId: string) {
  if (useSql()) {
    ensureSqlTable();
    db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(userId);
  } else {
    const all = readJson();
    let changed = false;
    for (const [k, rec] of Object.entries(all)) {
      if (rec.user_id === userId) {
        delete all[k];
        changed = true;
      }
    }
    if (changed) writeJson(all);
  }
}

// ---------- public API ----------

/** Start a session for a user who just signed in or registered; returns the new token. */
export function createSession(userId: string, userAgent?: string | null, token: string = generateToken()): string {
  const now = Date.now();
  insertRecord({
    token_hash: hashToken(token),
    user_id: userId,
    created_at: now,
    last_seen_at: now,
    expires_at: now + SESSION_TTL_MS,
    user_agent: userAgent ? userAgent.slice(0, 255) : null,
  });
  return token;
}

/** The user id a token belongs to, or null if it is unknown or expired. */
export function resolveSessionUserId(token: string): string | null {
  if (!token) return null;
  const tokenHash = hashToken(token);
  let rec: SessionRecord | null = null;
  try {
    rec = getRecord(tokenHash);
  } catch (e) {
    console.warn('[Sessions] lookup failed:', (e as Error).message);
    return null;
  }
  if (!rec) return null;
  const now = Date.now();
  if (rec.expires_at <= now) {
    try {
      deleteRecord(tokenHash);
    } catch {}
    return null;
  }
  if (now - rec.last_seen_at > TOUCH_INTERVAL_MS) {
    try {
      touchRecord(tokenHash, now);
    } catch {}
  }
  return rec.user_id;
}

/** Sign out one device. Also clears the legacy users.token column if it holds this token. */
export function endSession(token: string) {
  if (!token) return;
  try {
    deleteRecord(hashToken(token));
  } catch {}
  try {
    db.prepare('UPDATE users SET token = NULL WHERE token = ?').run(token);
  } catch {}
}

/**
 * Sign a user out everywhere (password change, suspension, deletion). Pass exceptToken to keep
 * the device making the change signed in, e.g. an admin changing their own password.
 */
export function endAllSessionsForUser(userId: string, exceptToken?: string) {
  try {
    deleteRecordsForUser(userId);
  } catch {}
  try {
    db.prepare('UPDATE users SET token = NULL WHERE id = ?').run(userId);
  } catch {}
  if (exceptToken) {
    try {
      createSession(userId, null, exceptToken);
    } catch {}
  }
}

const isActive = (row: any) => !!row && (row.status === 'ACTIVE' || row.status === null || row.status === undefined);

/**
 * The active user row for a token: first from sessions, then from the legacy users.token column
 * (moved into a session on first use so it keeps working after the column is cleared).
 */
export function findActiveUserByToken(token: string): any | null {
  if (!token || token.length < 16) return null;

  const userId = resolveSessionUserId(token);
  if (userId) {
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    // The JSON-store emulator ignores status filters, so check status here.
    return isActive(row) && row.id === userId ? row : null;
  }

  const legacy = db.prepare('SELECT * FROM users WHERE token = ?').get(token) as any;
  if (isActive(legacy) && legacy.token === token) {
    try {
      createSession(legacy.id, null, token);
    } catch {}
    return legacy;
  }
  return null;
}
