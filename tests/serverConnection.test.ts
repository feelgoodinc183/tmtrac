// The server connection status behind the header dot and the connection banner.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServerConnectionMonitor, MAX_SERVER_SILENCE_MS } from '../src/services/serverConnection';

function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

test('connecting, connected, then reconnecting after the socket closes', () => {
  const c = clock();
  const m = createServerConnectionMonitor({ now: c.now });
  assert.equal(m.get().state, 'connecting');
  c.advance(500);
  m.socketOpened();
  assert.equal(m.get().state, 'connected');
  assert.equal(m.get().since, c.now());
  c.advance(10_000);
  m.socketClosed();
  assert.equal(m.get().state, 'reconnecting');
  assert.equal(m.get().since, c.now());
});

test('a first try that fails says reconnecting, not connecting forever', () => {
  const m = createServerConnectionMonitor({ now: clock().now });
  m.socketClosed();
  assert.equal(m.get().state, 'connecting');
  m.connectFailed();
  assert.equal(m.get().state, 'reconnecting');
});

test('no network wins over reconnecting, and comes back to reconnecting', () => {
  const m = createServerConnectionMonitor({ now: clock().now });
  m.socketOpened();
  m.socketClosed();
  m.browserWentOffline();
  assert.equal(m.get().state, 'offline');
  m.browserWentOnline();
  assert.equal(m.get().state, 'reconnecting');
  m.socketOpened();
  assert.equal(m.get().state, 'connected');
});

test('the browser going offline while the socket is still open does not flag it yet', () => {
  const m = createServerConnectionMonitor({ now: clock().now });
  m.socketOpened();
  m.browserWentOffline();
  assert.equal(m.get().state, 'connected');
  m.socketClosed();
  assert.equal(m.get().state, 'offline');
});

test('an open socket the server has gone quiet on counts as silent', () => {
  const c = clock();
  const m = createServerConnectionMonitor({ now: c.now });
  assert.equal(m.isSilent(), false, 'not connected yet');
  m.socketOpened();
  c.advance(MAX_SERVER_SILENCE_MS - 1);
  assert.equal(m.isSilent(), false);
  m.messageReceived();
  c.advance(MAX_SERVER_SILENCE_MS + 1);
  assert.equal(m.isSilent(), true);
  m.socketClosed();
  assert.equal(m.isSilent(), false, 'a closed socket is not "silent", it is closed');
});

test('edits sent over HTTP: saved, or counted as lost until dismissed', () => {
  const m = createServerConnectionMonitor({ now: clock().now });
  m.socketOpened();
  m.socketClosed();
  assert.equal(m.get().httpSaving, null);
  m.httpEditResult(true);
  assert.deepEqual([m.get().httpSaving, m.get().lostEdits], [true, 0]);
  m.httpEditResult(false);
  m.httpEditResult(false);
  assert.deepEqual([m.get().httpSaving, m.get().lostEdits], [false, 2]);
  // Reconnecting doesn't bring lost edits back, so the count stays until the person dismisses it
  m.socketOpened();
  assert.equal(m.get().httpSaving, null);
  assert.equal(m.get().lostEdits, 2);
  m.clearLostEdits();
  assert.equal(m.get().lostEdits, 0);
});

test('subscribers hear changes only, and can unsubscribe', () => {
  const m = createServerConnectionMonitor({ now: clock().now });
  const seen: string[] = [];
  const off = m.subscribe((s) => seen.push(s.state));
  m.socketOpened();
  m.socketOpened();
  m.socketClosed();
  off();
  m.socketOpened();
  assert.deepEqual(seen, ['connecting', 'connected', 'reconnecting']);
});
