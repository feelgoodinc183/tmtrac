// Skippers connecting their own tracker: the server's rule, and the server end to end (WebSocket + SQLite).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { DatabaseSync } from 'node:sqlite';
import WebSocket from 'ws';
import { decideSkipperBinding } from '../src/server/skipperBinding';

const ON = { skipperConnectEnabled: true };
const boats = () => [
  { id: 'b1', name: 'Alpha', nodeId: null as string | null },
  { id: 'b2', name: 'Bravo', nodeId: '!0000beef' },
];

test('a skipper binds a tracker to a boat that has none, when the option is on', () => {
  const d = decideSkipperBinding(boats(), ON, 'PARTICIPANT', { boatId: 'b1', nodeId: '!A1B2C3D4' });
  assert.ok(d.ok && d.changed);
  if (!('reason' in d)) {
    assert.equal(d.nodeId, '!a1b2c3d4', 'stored in canonical form');
    assert.equal(d.boats.find((b) => b.id === 'b1')!.nodeId, '!a1b2c3d4');
    assert.equal(d.boats.find((b) => b.id === 'b2')!.nodeId, '!0000beef');
  }
});

test('skipper binding is refused unless every rule holds', () => {
  const reason = (raceState: unknown, role: string, req: unknown) => {
    const d = decideSkipperBinding(boats(), raceState, role, req);
    return 'reason' in d ? d.reason : 'OK';
  };
  const req = { boatId: 'b1', nodeId: '!a1b2c3d4' };
  assert.equal(reason({}, 'PARTICIPANT', req), 'DISABLED');
  assert.equal(reason({ skipperConnectEnabled: 'yes' }, 'PARTICIPANT', req), 'DISABLED');
  assert.equal(reason(ON, 'SPECTATOR', req), 'NOT_PARTICIPANT');
  assert.equal(reason(ON, 'PARTICIPANT', { boatId: 'b1' }), 'BAD_REQUEST');
  assert.equal(reason(ON, 'PARTICIPANT', { boatId: 'b1', nodeId: '!DEV-1A2B' }), 'NOT_A_TRACKER');
  assert.equal(reason(ON, 'PARTICIPANT', { boatId: 'nope', nodeId: '!a1b2c3d4' }), 'NO_SUCH_BOAT');
  assert.equal(reason(ON, 'PARTICIPANT', { boatId: 'b2', nodeId: '!a1b2c3d4' }), 'BOAT_HAS_TRACKER');
  assert.equal(reason(ON, 'PARTICIPANT', { boatId: 'b1', nodeId: '!0000BEEF' }), 'TRACKER_IN_USE');
  // The race office isn't held to the option
  assert.equal(reason({}, 'RACE_OFFICER', req), 'OK');
});

test('asking again for the binding already there changes nothing', () => {
  const list = boats();
  const d = decideSkipperBinding(list, ON, 'PARTICIPANT', { boatId: 'b2', nodeId: '!0000beef' });
  assert.ok(d.ok && !d.changed);
  if (!('reason' in d)) assert.equal(d.boats, list);
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

test('skipper binding end to end: off by default, then gated, broadcast and persisted', { timeout: 90_000 }, async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tmtrac-skipper-'));
  const port = await freePort();
  let server = await startServer(dataDir, port);
  try {
    const db = new DatabaseSync(path.join(dataDir, 'tmtrac.db'));
    const { admin_pin: adminPin, participant_pin: skipperPin } = db
      .prepare(`SELECT admin_pin, participant_pin FROM events WHERE code = 'LOBBY'`)
      .get() as any;
    db.close();

    const officer = await connect(port, adminPin);
    const skipper = await connect(port, skipperPin);
    const spectator = await connect(port);
    await officer.next('SESSION_INIT_STATE');
    assert.equal((await skipper.next('SESSION_INIT_STATE')).userRole, 'PARTICIPANT');
    await spectator.next('SESSION_INIT_STATE');

    officer.ws.send(JSON.stringify({ type: 'UPDATE_BOATS', payload: boats() }));
    await skipper.next('BOATS_UPDATED');
    await spectator.next('BOATS_UPDATED');

    const ask = (c: Client, payload: any) => {
      c.ws.send(JSON.stringify({ type: 'SKIPPER_BIND_TRACKER', payload }));
      return c.next('SKIPPER_BIND_RESULT');
    };

    // Off until the race office turns it on
    let res = await ask(skipper, { requestId: 'r1', boatId: 'b1', nodeId: '!a1b2c3d4' });
    assert.deepEqual([res.requestId, res.ok, res.reason], ['r1', false, 'DISABLED']);
    assert.match(res.message, /race office/);

    // A skipper can't turn it on themselves
    skipper.ws.send(JSON.stringify({ type: 'UPDATE_RACE_STATE', payload: { skipperConnectEnabled: true, updatedAt: Date.now() } }));
    assert.equal((await skipper.next('UPDATE_REJECTED')).action, 'UPDATE_RACE_STATE');

    officer.ws.send(JSON.stringify({ type: 'UPDATE_RACE_STATE', payload: { skipperConnectEnabled: true, updatedAt: Date.now() } }));
    assert.equal((await skipper.next('RACE_STATE_UPDATED')).skipperConnectEnabled, true);

    // Spectators still can't
    res = await ask(spectator, { requestId: 'r2', boatId: 'b1', nodeId: '!a1b2c3d4' });
    assert.equal(res.reason, 'NOT_PARTICIPANT');

    // Bravo's tracker can't be taken
    res = await ask(skipper, { requestId: 'r3', boatId: 'b2', nodeId: '!a1b2c3d4' });
    assert.equal(res.reason, 'BOAT_HAS_TRACKER');

    // Accepted: everyone, the skipper included, gets the fleet with the binding
    res = await ask(skipper, { requestId: 'r4', boatId: 'b1', nodeId: '!A1B2C3D4' });
    assert.deepEqual([res.requestId, res.ok, res.boatId, res.nodeId], ['r4', true, 'b1', '!a1b2c3d4']);
    for (const c of [officer, skipper, spectator]) {
      const fleet = await c.next('BOATS_UPDATED');
      assert.equal(fleet.find((b: any) => b.id === 'b1').nodeId, '!a1b2c3d4');
    }

    // The tracker is now in use, so it can't go on another boat either
    officer.ws.send(JSON.stringify({ type: 'UPDATE_BOATS', payload: [...boats().map((b) => (b.id === 'b1' ? { ...b, nodeId: '!a1b2c3d4' } : b)), { id: 'b3', name: 'Charlie', nodeId: null }] }));
    await skipper.next('BOATS_UPDATED');
    res = await ask(skipper, { requestId: 'r5', boatId: 'b3', nodeId: '!a1b2c3d4' });
    assert.equal(res.reason, 'TRACKER_IN_USE');

    for (const c of [officer, skipper, spectator]) c.ws.close();

    // The binding and the option survive a restart
    await stopServer(server);
    server = await startServer(dataDir, port);
    const after = await connect(port);
    const init = await after.next('SESSION_INIT_STATE');
    assert.equal(init.raceState.skipperConnectEnabled, true);
    assert.equal(init.boats.find((b: any) => b.id === 'b1').nodeId, '!a1b2c3d4');
    after.ws.close();
  } finally {
    await stopServer(server);
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
