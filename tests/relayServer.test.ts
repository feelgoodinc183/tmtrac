// End-to-end tests of tracker relaying against a real server (server.ts on a free port, with a
// throwaway data folder): who may relay a LoRa tracker, which boat a position moves, and offline
// marking when the relaying phone disconnects. Positions come from the T-Echo replay fixture.
//
// The tests run in order against one server and share its room state; each builds on the last.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import WebSocket from 'ws';
import { decodeFromRadio, decodePosition, positionLatLng, positionSpeedKt, PortNum } from '../src/services/meshtastic/protocol';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ROOM = 'RLIR26';

// --- Positions from the recording, per node ------------------------------------------------------
const positions = new Map<string, { lat: number; lng: number; speedKt?: number }[]>();
const hex = (n: number) => `!${(n >>> 0).toString(16).padStart(8, '0')}`;
for (const line of readFileSync(path.join(ROOT, 'tests/fixtures/techo-rm1-usb.jsonl'), 'utf8').split('\n')) {
  if (!line.trim()) continue;
  const rec = JSON.parse(line);
  if (rec.dir !== 'from') continue;
  const fr = decodeFromRadio(Buffer.from(rec.b64, 'base64'));
  const add = (id: string, pos: any) => {
    const ll = pos && positionLatLng(pos);
    if (!ll) return;
    positions.set(id, [...(positions.get(id) || []), { ...ll, speedKt: positionSpeedKt(pos) }]);
  };
  if (fr.nodeInfo?.num !== undefined) add(hex(fr.nodeInfo.num), fr.nodeInfo.position);
  if (fr.packet?.decoded?.portnum === PortNum.POSITION_APP && fr.packet.from !== undefined) {
    add(hex(fr.packet.from), decodePosition(fr.packet.decoded.payload!));
  }
}
const TRACKER = '!a12264da'; // RM2 in the recording
const STRANGER = [...positions.keys()].find((id) => id !== TRACKER)!;
const fix = (id: string, i = 0) => { const l = positions.get(id)!; return l[Math.min(i, l.length - 1)]; };

// Test boats start at 1, 1: far from every recorded position, so "moved" is unambiguous
const boat = (id: string, nodeId: string | null) => ({ id, name: id, sailNumber: id, class: 'Class 1', handicapSystem: 'IRC',
  handicapRating: 1, skipper: '', nodeId, lat: 1, lng: 1, sog: 0, cog: 0, vmg: 0, dtw: 0, heading: 0, status: 'PRE_START',
  markRoundings: [], elapsedSeconds: 0, correctedSeconds: 0, color: '#0af', trail: [] });
const relayMsg = (id: string, relayedBy: string, extra: Record<string, unknown> = {}) => {
  const p = fix(id);
  return { deviceId: id, deviceName: id, deviceType: 'LORA_TECHO', role: 'COMPETITOR', lat: p.lat, lng: p.lng,
    speedKt: p.speedKt ?? 0, timestamp: Date.now(), isLocalUser: false, trail: [{ lat: p.lat, lng: p.lng }], relayedBy, ...extra };
};
const latOf = (boats: any[] | undefined, id: string) => boats?.find((b: any) => b.id === id)?.lat;

// --- Server and sockets ---------------------------------------------------------------------------
let server: ChildProcess;
let serverLog = '';
let dataDir: string;
let port: number;
let pins: { admin: string; participant: string };

type Client = { ws: WebSocket; msgs: any[]; name: string };
const clients: Client[] = [];
let admin: Client, phoneA: Client, phoneB: Client, spectator: Client;

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const p = (s.address() as any).port;
      s.close(() => resolve(p));
    });
  });
}

function connect(name: string, pin: string): Promise<Client> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?room=${ROOM}&pin=${encodeURIComponent(pin)}`);
    const c: Client = { ws, msgs: [], name };
    ws.on('message', (raw) => {
      const m = JSON.parse(raw.toString());
      c.msgs.push(m);
      if (m.type === 'SESSION_INIT_STATE') { clients.push(c); resolve(c); }
    });
    ws.on('error', reject);
  });
}
const send = (c: Client, type: string, payload: unknown) => c.ws.send(JSON.stringify({ type, payload }));
const since = (c: Client, n: number, type: string) => c.msgs.slice(n).filter((m) => m.type === type);

/**
 * Barrier: each open socket in turn sends VERIFY_PIN with an empty PIN (no role change, not counted
 * as a wrong PIN) and waits for the reply. The server handles a socket's messages in order, so once
 * every socket has its reply, everything sent before has been handled and its broadcasts delivered.
 * (Fixed sleeps aren't enough: the server can be busy compiling for seconds after start.)
 */
async function settle() {
  for (const c of clients.filter((c) => c.ws.readyState === WebSocket.OPEN)) {
    const n = c.msgs.length;
    send(c, 'VERIFY_PIN', { pin: '' });
    for (let i = 0; i < 300 && !since(c, n, 'PIN_VERIFICATION_RESULT').length; i++) await new Promise((r) => setTimeout(r, 50));
    assert.ok(since(c, n, 'PIN_VERIFICATION_RESULT').length, `${c.name}: no barrier reply`);
  }
}

const boatsNow = async () => (await (await fetch(`http://127.0.0.1:${port}/api/session/state?room=${ROOM}`)).json()).boats;
const postBatch = (body: unknown) => fetch(`http://127.0.0.1:${port}/api/session/gps/batch?room=${ROOM}`, {
  method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-pin': pins.participant }, body: JSON.stringify(body) });
const points = (lat: number) => [{ lat, lng: 2, timestamp: Date.now() }];

before(async () => {
  assert.ok(positions.has(TRACKER) && STRANGER, 'fixture has RM2 and another node with positions');
  dataDir = mkdtempSync(path.join(tmpdir(), 'tmtrac-relay-test-'));
  port = await freePort();
  server = spawn(process.execPath, ['--import', 'tsx', 'server.ts', '--port', String(port)], {
    cwd: ROOT,
    env: { ...process.env, DATA_DIR: dataDir, NODE_ENV: 'development' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout!.on('data', (d) => { serverLog += d; });
  server.stderr!.on('data', (d) => { serverLog += d; });

  let up = false;
  for (let i = 0; i < 240 && !up; i++) {
    try { up = (await fetch(`http://127.0.0.1:${port}/api/session/state?room=${ROOM}`)).ok; } catch {}
    if (!up) await new Promise((r) => setTimeout(r, 250));
  }
  assert.ok(up, 'server did not start:\n' + serverLog.slice(-3000));

  const db = new DatabaseSync(path.join(dataDir, 'tmtrac.db'), { readOnly: true });
  const row = db.prepare('SELECT admin_pin, participant_pin FROM events WHERE code = ?').get(ROOM) as any;
  db.close();
  pins = { admin: row.admin_pin, participant: row.participant_pin };

  admin = await connect('admin', pins.admin);
  phoneA = await connect('phoneA', pins.participant);
  phoneB = await connect('phoneB', pins.participant);
  spectator = await connect('spectator', '');
}, { timeout: 90_000 });

after(async () => {
  for (const c of clients) c.ws.terminate();
  // Wait for the server to exit before removing its data folder: on Windows an open database
  // file can't be deleted
  if (server && server.exitCode === null) {
    await new Promise<void>((resolve) => {
      server.once('exit', () => resolve());
      server.kill();
    });
  }
  if (dataDir) rmSync(dataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}, { timeout: 30_000 });

// --- WebSocket relaying ---------------------------------------------------------------------------
test('roles come from the PINs: admin, participants, spectator', () => {
  assert.equal(admin.msgs[0].payload.userRole, 'ADMIN');
  assert.equal(phoneA.msgs[0].payload.userRole, 'PARTICIPANT');
  assert.equal(phoneB.msgs[0].payload.userRole, 'PARTICIPANT');
  assert.equal(spectator.msgs[0].payload.userRole, 'SPECTATOR');
});

test('a bound tracker relayed by a phone reaches the room online, on the boat the room binds it to', async () => {
  // b1 names the tracker in upper case, as older rooms may store it; b2 has no tracker
  send(admin, 'UPDATE_BOATS', [boat('b1', TRACKER.toUpperCase()), boat('b2', null)]);
  await settle();
  const n = admin.msgs.length;
  send(phoneA, 'GPS_BROADCAST', relayMsg(TRACKER, 'phone-A', { boundBoatId: 'b2' }));
  await settle();
  const ups = since(admin, n, 'TRACKER_POSITION_UPDATE');
  assert.equal(ups.length, 1);
  assert.equal(ups[0].payload.deviceId, TRACKER);
  assert.equal(ups[0].payload.isOnline, true);
  assert.equal(ups[0].payload.boundBoatId, 'b1', 'the claimed b2 is ignored');
});

test('an unbound node is not relayed, even claiming a boat', async () => {
  const n = admin.msgs.length;
  send(phoneA, 'GPS_BROADCAST', relayMsg(STRANGER, 'phone-A', { boundBoatId: 'b2' }));
  await settle();
  assert.deepEqual(since(admin, n, 'TRACKER_POSITION_UPDATE'), []);
});

test('a bare decimal node id is not read as hex', async () => {
  const n = admin.msgs.length;
  send(phoneA, 'GPS_BROADCAST', relayMsg(TRACKER, 'phone-A', { deviceId: String(parseInt(TRACKER.slice(1), 16)) }));
  await settle();
  assert.deepEqual(since(admin, n, 'TRACKER_POSITION_UPDATE'), []);
});

test('a second phone cannot relay a tracker another phone is relaying', async () => {
  const n = admin.msgs.length;
  send(phoneB, 'GPS_BROADCAST', relayMsg(TRACKER, 'phone-B'));
  await settle();
  assert.deepEqual(since(admin, n, 'TRACKER_POSITION_UPDATE'), []);

  const nb = phoneB.msgs.length;
  send(phoneB, 'GPS_BATCH_BACKFILL', { ...relayMsg(TRACKER, 'phone-B'), batchId: 'batch-B1', points: [{ ...fix(TRACKER), timestamp: Date.now() }] });
  await settle();
  const rej = since(phoneB, nb, 'GPS_BATCH_REJECTED');
  assert.equal(rej.length, 1);
  assert.equal(rej[0].payload.reason, 'NOT_RELAYABLE');
  assert.equal(rej[0].payload.batchId, 'batch-B1');
});

test('a spectator cannot relay', async () => {
  const n = admin.msgs.length;
  send(spectator, 'GPS_BROADCAST', relayMsg(TRACKER, 'spectator'));
  await settle();
  assert.deepEqual(since(admin, n, 'TRACKER_POSITION_UPDATE'), []);
});

test('when the relaying phone disconnects, its own device and the relayed tracker go offline', async () => {
  send(phoneA, 'GPS_BROADCAST', { deviceId: 'phone-A', deviceName: 'Phone A', deviceType: 'MOBILE_GPS',
    lat: fix(TRACKER).lat + 0.001, lng: fix(TRACKER).lng, timestamp: Date.now() });
  await settle();
  const n = admin.msgs.length;
  await new Promise((r) => { phoneA.ws.once('close', r); phoneA.ws.close(); });
  await new Promise((r) => setTimeout(r, 200));
  await settle();
  const offline = since(admin, n, 'TRACKER_POSITION_UPDATE').map((m) => m.payload);
  assert.ok(offline.some((t) => t.deviceId === TRACKER && t.isOnline === false), 'relayed tracker offline');
  assert.ok(offline.some((t) => t.deviceId === 'phone-A' && t.isOnline === false), 'phone offline');
});

test('another phone can relay once the first has gone; the backfill moves only the bound boat', async () => {
  const na = admin.msgs.length;
  const nb = phoneB.msgs.length;
  send(phoneB, 'GPS_BATCH_BACKFILL', { ...relayMsg(TRACKER, 'phone-B'), batchId: 'batch-B2', points: [{ ...fix(TRACKER, 1), timestamp: Date.now() }] });
  await settle();
  assert.ok(since(phoneB, nb, 'GPS_BATCH_ACK').some((m) => m.payload.batchId === 'batch-B2'));
  const boats = since(admin, na, 'BOATS_UPDATED').at(-1)?.payload;
  assert.equal(latOf(boats, 'b1'), fix(TRACKER, 1).lat);
  assert.equal(latOf(boats, 'b2'), 1);
});

test('after rebinding the tracker to another boat, only the new boat moves', async () => {
  send(admin, 'UPDATE_BOATS', [boat('b1', null), boat('b2', TRACKER)]);
  await settle();
  const na = admin.msgs.length;
  send(phoneB, 'GPS_BATCH_BACKFILL', { ...relayMsg(TRACKER, 'phone-B'), batchId: 'batch-B3', points: [{ ...fix(TRACKER), timestamp: Date.now() }] });
  await settle();
  const boats = since(admin, na, 'BOATS_UPDATED').at(-1)?.payload;
  assert.equal(latOf(boats, 'b2'), fix(TRACKER).lat);
  assert.equal(latOf(boats, 'b1'), 1);
});

test('a tracker still named on two boats (a stale nodeId) moves only one of them', async () => {
  send(admin, 'UPDATE_BOATS', [boat('b1', TRACKER), boat('b2', TRACKER)]);
  await settle();
  const na = admin.msgs.length;
  send(phoneB, 'GPS_BATCH_BACKFILL', { ...relayMsg(TRACKER, 'phone-B'), batchId: 'batch-B4', points: [{ ...fix(TRACKER), timestamp: Date.now() }] });
  await settle();
  const boats = since(admin, na, 'BOATS_UPDATED').at(-1)?.payload || [];
  assert.equal(boats.filter((b: any) => b.lat !== 1).length, 1);
});

// --- A claimed boundBoatId is ignored everywhere; the room's binding decides ---------------------
const PHONE = 'device-7f3a9c1e-b2d4';
const PHONE_ALIAS = `!DEV-${PHONE.replace(/[^A-Za-z0-9]/g, '').slice(-4).toUpperCase()}`; // as deviceTrackerService.getLocalNode()

test('HTTP batch: an unbound device claiming a boat is stored, but the boat does not move', async () => {
  send(admin, 'UPDATE_BOATS', [boat('b1', TRACKER), boat('b2', null), boat('b3', PHONE_ALIAS)]);
  await settle();
  const r = await postBatch({ deviceId: 'phone-stranger', boundBoatId: 'b1', points: points(50) });
  assert.equal(r.status, 200);
  assert.notEqual(latOf(await boatsNow(), 'b1'), 50);
});

test('HTTP batch: relaying an unbound tracker is refused with NOT_RELAYABLE', async () => {
  const r = await postBatch({ deviceId: STRANGER, relayedBy: 'phone-X', boundBoatId: 'b2', points: points(51) });
  assert.equal(r.status, 403);
  assert.equal((await r.json()).reason, 'NOT_RELAYABLE');
  assert.equal(latOf(await boatsNow(), 'b2'), 1);
});

test('HTTP batch: a relayed bound tracker moves its own boat, not the claimed one', async () => {
  const r = await postBatch({ deviceId: TRACKER, relayedBy: 'phone-X', boundBoatId: 'b2', points: points(52) });
  assert.equal(r.status, 200);
  const boats = await boatsNow();
  assert.equal(latOf(boats, 'b1'), 52);
  assert.equal(latOf(boats, 'b2'), 1);
});

test('HTTP batch: a phone bound by its !DEV- alias moves its own boat, not the claimed one', async () => {
  const r = await postBatch({ deviceId: PHONE, boundBoatId: 'b2', points: points(53) });
  assert.equal(r.status, 200);
  const boats = await boatsNow();
  assert.equal(latOf(boats, 'b3'), 53);
  assert.equal(latOf(boats, 'b2'), 1);
});

test('WebSocket: an unbound phone\'s own backfill claiming a boat is acked, but the boat does not move', async () => {
  const wsPhone = await connect('wsPhone', pins.participant);
  const n = wsPhone.msgs.length;
  send(wsPhone, 'GPS_BATCH_BACKFILL', { deviceId: 'phone-other', boundBoatId: 'b1', batchId: 'own-1', points: points(54) });
  await settle();
  assert.equal(since(wsPhone, n, 'GPS_BATCH_ACK').length, 1);
  assert.equal(latOf(await boatsNow(), 'b1'), 52);

  const na = admin.msgs.length;
  send(wsPhone, 'GPS_BROADCAST', { deviceId: 'phone-other', boundBoatId: 'b1', lat: 55, lng: 2, timestamp: Date.now() });
  await settle();
  const live = since(admin, na, 'TRACKER_POSITION_UPDATE').map((m) => m.payload);
  assert.equal(live.length, 1);
  assert.equal(live[0].boundBoatId, null, 'a live position\'s claimed boat is replaced by the binding (none)');
});
