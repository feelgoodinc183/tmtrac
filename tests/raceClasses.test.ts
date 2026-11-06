// Race classes as room state: payload checks, and the server end to end (WebSocket + SQLite).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { DatabaseSync } from 'node:sqlite';
import WebSocket from 'ws';
import { MAX_RACE_CLASSES, parseStoredRaceClasses, sanitizeRaceClasses } from '../src/server/raceClasses';

test('sanitizeRaceClasses keeps known fields and drops unusable items', () => {
  const out = sanitizeRaceClasses([
    { id: 'c1', name: ' Class 1 ', ratingSystem: 'IRC', defaultRating: 1.05, color: '#00D4FF', extra: 'x' },
    { id: 'c1', name: 'Duplicate id' },
    { id: '', name: 'No id' },
    { id: 'c3' },
    null,
    'nope',
    { id: 'c4', name: 'Bad fields', ratingSystem: 'XYZ', defaultRating: -1 },
  ]);
  assert.deepEqual(out, [
    { id: 'c1', name: 'Class 1', ratingSystem: 'IRC', defaultRating: 1.05, color: '#00D4FF' },
    { id: 'c4', name: 'Bad fields' },
  ]);
});

test('sanitizeRaceClasses rejects payloads that cannot be a class list', () => {
  assert.equal(sanitizeRaceClasses(undefined), null);
  assert.equal(sanitizeRaceClasses({ id: 'c1', name: 'x' }), null);
  assert.equal(sanitizeRaceClasses([]), null);
  assert.equal(sanitizeRaceClasses([{ id: 'c1' }]), null);
  const tooMany = Array.from({ length: MAX_RACE_CLASSES + 1 }, (_, i) => ({ id: `c${i}`, name: `C${i}` }));
  assert.equal(sanitizeRaceClasses(tooMany), null);
});

test('parseStoredRaceClasses treats missing or broken JSON as not set', () => {
  assert.equal(parseStoredRaceClasses(null), null);
  assert.equal(parseStoredRaceClasses(''), null);
  assert.equal(parseStoredRaceClasses('{bad'), null);
  assert.deepEqual(parseStoredRaceClasses('[{"id":"a","name":"A"}]'), [{ id: 'a', name: 'A' }]);
});

// ---------- server end to end ----------

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address() as net.AddressInfo;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

async function startServer(dataDir: string, port: number): Promise<ChildProcess> {
  const child = spawn(process.execPath, ['--import', 'tsx', 'server.ts', '--port', String(port)], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: 'production', DATA_DIR: dataDir },
    stdio: 'ignore',
  });
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`server exited with ${child.exitCode}`);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/session/state?room=LOBBY`);
      if (res.ok) return child;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  child.kill();
  throw new Error('server did not start');
}

async function stopServer(child: ChildProcess) {
  if (child.exitCode !== null) return;
  const exited = new Promise((r) => child.once('exit', r));
  child.kill();
  await exited;
}

type Client = { ws: WebSocket; next: (type: string) => Promise<any> };

function connect(port: number, pin = ''): Promise<Client> {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?room=LOBBY${pin ? `&pin=${pin}` : ''}`);
  const queue: any[] = [];
  const waiters: Array<{ type: string; resolve: (m: any) => void }> = [];
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    const i = waiters.findIndex((w) => w.type === msg.type);
    if (i >= 0) waiters.splice(i, 1)[0].resolve(msg.payload);
    else queue.push(msg);
  });
  const next = (type: string) =>
    new Promise<any>((resolve, reject) => {
      const i = queue.findIndex((m) => m.type === type);
      if (i >= 0) return resolve(queue.splice(i, 1)[0].payload);
      const timer = setTimeout(() => reject(new Error(`timed out waiting for ${type}`)), 5000);
      waiters.push({ type, resolve: (m) => { clearTimeout(timer); resolve(m); } });
    });
  return new Promise((resolve, reject) => {
    ws.once('open', () => resolve({ ws, next }));
    ws.once('error', reject);
  });
}

test('race classes are room state: gated, broadcast, and persisted', { timeout: 90_000 }, async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tmtrac-classes-'));
  const port = await freePort();
  let server = await startServer(dataDir, port);
  try {
    const db = new DatabaseSync(path.join(dataDir, 'tmtrac.db'));
    const { admin_pin: adminPin } = db.prepare(`SELECT admin_pin FROM events WHERE code = 'LOBBY'`).get() as any;
    db.close();

    const officer = await connect(port, adminPin);
    const spectator = await connect(port);
    const officerInit = await officer.next('SESSION_INIT_STATE');
    const spectatorInit = await spectator.next('SESSION_INIT_STATE');
    assert.equal(officerInit.canEdit, true);
    assert.equal(officerInit.raceClasses, null, 'a new room has no classes yet');
    assert.equal(spectatorInit.raceClasses, null);

    // A spectator can't change the classes
    spectator.ws.send(JSON.stringify({ type: 'UPDATE_CLASSES', payload: [{ id: 'x', name: 'Hijack' }] }));
    const rejected = await spectator.next('UPDATE_REJECTED');
    assert.equal(rejected.action, 'UPDATE_CLASSES');

    // The race officer's classes reach the other device
    const classes = [
      { id: 'class-1', name: 'IRC 1', ratingSystem: 'IRC', color: '#00D4FF' },
      { id: 'class-9', name: 'Lasers', ratingSystem: 'PY' },
    ];
    officer.ws.send(JSON.stringify({ type: 'UPDATE_CLASSES', payload: classes }));
    assert.deepEqual(await spectator.next('CLASSES_UPDATED'), classes);

    // A late joiner gets them in the init state
    const late = await connect(port);
    assert.deepEqual((await late.next('SESSION_INIT_STATE')).raceClasses, classes);
    for (const c of [officer, spectator, late]) c.ws.close();

    // They survive a server restart (stored in SQLite, not just memory)
    await stopServer(server);
    server = await startServer(dataDir, port);
    const afterRestart = await connect(port);
    assert.deepEqual((await afterRestart.next('SESSION_INIT_STATE')).raceClasses, classes);
    afterRestart.ws.close();
  } finally {
    await stopServer(server);
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
