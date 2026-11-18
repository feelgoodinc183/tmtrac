// Inside the Android app, GPS comes from the background plugin and the web view at once.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { createPositionMerger, NATIVE_PREFERRED_MS, ERROR_AFTER_MS } = await import('../src/services/native/positionWatch');

const pos = (lat: number) => ({ coords: { latitude: lat, longitude: 101, accuracy: 5, altitude: null, speed: null, heading: null }, timestamp: 0 });
const err = (code: 1 | 2 | 3, message = '') => ({ code, message, PERMISSION_DENIED: 1 as const, POSITION_UNAVAILABLE: 2 as const, TIMEOUT: 3 as const });

function setup() {
  let t = 1_000_000;
  const fixes: number[] = [];
  const errors: { code: number; message: string }[] = [];
  const m = createPositionMerger((p) => fixes.push(p.coords.latitude), (e) => errors.push(e), () => t);
  return { m, fixes, errors, advance: (ms: number) => { t += ms; } };
}

test('GPS in the app: the web view fix is used when the plugin never answers (no Google services)', () => {
  const { m, fixes, errors } = setup();
  m.fix('web', pos(3.1));
  assert.deepEqual(fixes, [3.1]);
  assert.equal(errors.length, 0);
});

test('GPS in the app: plugin fixes win while they keep coming; web fixes fill in once they stop', () => {
  const { m, fixes, advance } = setup();
  m.fix('native', pos(1));
  advance(1000);
  m.fix('web', pos(99)); // ignored: the plugin is delivering
  m.fix('native', pos(2));
  advance(NATIVE_PREFERRED_MS + 1);
  m.fix('web', pos(3)); // plugin has gone quiet
  assert.deepEqual(fixes, [1, 2, 3]);
});

test('GPS in the app: the plugin refusing "approximate" location does not hide a working web GPS', () => {
  const { m, fixes, errors } = setup();
  m.error('native', err(1, 'User denied location permission'));
  m.fix('web', pos(5));
  assert.deepEqual(errors, []);
  assert.deepEqual(fixes, [5]);
});

test('GPS in the app: when both fail, the web view error is shown (it reflects the real permission)', () => {
  const { m, errors } = setup();
  m.error('native', err(2, 'Location services disabled.'));
  assert.equal(errors.length, 0);
  m.error('web', err(1, 'denied'));
  assert.equal(errors.length, 1);
  assert.equal(errors[0].code, 1);
});

test('GPS in the app: one failing source is reported once nothing has arrived for a while', () => {
  const { m, errors, advance } = setup();
  m.error('native', err(2, 'Could not start background GPS.'));
  assert.equal(errors.length, 0);
  advance(ERROR_AFTER_MS);
  m.error('native', err(2, 'Could not start background GPS.'));
  assert.equal(errors.length, 1);
});

test('GPS in the app: a fix clears earlier errors', () => {
  const { m, errors, advance } = setup();
  m.error('native', err(2));
  m.fix('web', pos(1));
  advance(1000);
  m.error('web', err(3)); // a single timeout right after a fix is not shown
  assert.equal(errors.length, 0);
});
