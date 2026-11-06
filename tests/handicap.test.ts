// Corrected time per rating system.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { correctedSeconds } from '../src/services/handicap';
import { recordFinish } from '../src/services/recallAndFinish';

test('IRC and ORC multiply elapsed time by the TCC', () => {
  assert.equal(correctedSeconds(3600, 'IRC', 1.05), 3780);
  assert.equal(correctedSeconds(3600, 'ORC', 0.95), 3420);
});

test('Portsmouth divides by the Portsmouth Number: a slower boat gets time back', () => {
  assert.equal(correctedSeconds(3600, 'PY', 1000), 3600);
  assert.equal(correctedSeconds(3300, 'PY', 1100), 3000);
  // Ratio form (what the boat form used to suggest) means the same
  assert.equal(correctedSeconds(3300, 'PY', 1.1), 3000);
  // The slower boat (PN 1200) finishing 10% behind the faster one (PN 1090) wins on corrected time
  const fast = correctedSeconds(3600, 'PY', 1090);
  const slow = correctedSeconds(3960, 'PY', 1200);
  assert.ok(slow < fast, `${slow} < ${fast}`);
});

test('a missing or bad rating leaves elapsed time as it is', () => {
  for (const r of [undefined, 0, -1, NaN]) assert.equal(correctedSeconds(100, 'PY', r as any), 100);
  assert.equal(correctedSeconds(100, undefined, 1.2), 120);
});

test('a finish recorded by hand uses the same rule', () => {
  const b: any = { id: 'a', status: 'RACING', handicapSystem: 'PY', handicapRating: 1100, elapsedSeconds: 0 };
  assert.equal(recordFinish(b, 3_300_000, 0).correctedSeconds, 3000);
});
