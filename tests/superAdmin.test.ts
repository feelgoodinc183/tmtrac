// Super Admin rights come from the account's flag only: seeded once from the environment, and never
// granted to whoever holds a particular email or username.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { DatabaseSync } from 'node:sqlite';

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
    env: { ...process.env, NODE_ENV: 'production', DATA_DIR: dataDir, SUPER_ADMIN_EMAIL: 'Boss@Club.test', SUPER_ADMIN_PASSWORD: 'Secret-pass-123' },
    stdio: 'ignore',
  });
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`server exited with ${child.exitCode}`);
    try {
      if ((await fetch(`http://127.0.0.1:${port}/api/session/state?room=LOBBY`)).ok) return child;
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

const supers = (dbPath: string) => {
  const db = new DatabaseSync(dbPath);
  const rows = (db.prepare('SELECT id, email, username, full_name FROM users WHERE is_super_admin = 1 ORDER BY id').all() as any[]).map((r) => ({ ...r }));
  db.close();
  return rows;
};

test('Super Admin: seeded from the environment, and no email or username grants the rights', { timeout: 120_000 }, async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tmtrac-superadmin-'));
  const dbPath = path.join(dataDir, 'tmtrac.db');
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const login = (who: string, password: string) =>
    fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ login: who, password }) });
  let server = await startServer(dataDir, port);
  try {
    // A fresh install has one Super Admin, from SUPER_ADMIN_EMAIL, with no personal details
    assert.deepEqual(supers(dbPath), [{ id: 'user-admin-0', email: 'boss@club.test', username: 'superadmin', full_name: 'Super Admin' }]);

    assert.equal((await login('superadmin', 'Secret-pass-123')).status, 200);
    assert.equal((await login('boss@club.test', 'Secret-pass-123')).status, 200);
    // 'admin' is no longer a shortcut to the first admin account
    assert.equal((await login('admin', 'Secret-pass-123')).status, 401);

    // The Super Admin moves to another address; someone registers the old one and the old username
    await stopServer(server);
    const db = new DatabaseSync(dbPath);
    db.prepare("UPDATE users SET email = 'new-boss@club.test' WHERE id = 'user-admin-0'").run();
    db.close();
    server = await startServer(dataDir, port);
    const reg = await fetch(`${base}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'boss@club.test', username: 'irsyadismail', password: 'whatever-123', fullName: 'Someone Else' }),
    });
    assert.ok(reg.ok, `registered: ${reg.status}`);

    // After a restart, the newcomer has no Super Admin rights and no second Super Admin was seeded
    await stopServer(server);
    server = await startServer(dataDir, port);
    assert.deepEqual(supers(dbPath).map((u) => [u.id, u.email]), [['user-admin-0', 'new-boss@club.test']]);
  } finally {
    await stopServer(server);
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
