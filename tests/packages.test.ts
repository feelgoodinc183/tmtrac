// Plans: stored defaults move from US dollars to ringgit once, features the product lacks come off.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultPackages, migratePackageRow } from '../src/server/packages';
import { formatPrice } from '../src/utils/pricing';

const old = (id: string, price: number, features: string[], currency = 'USD') => ({
  ...defaultPackages(0).find((p) => p.id === id)!,
  price_amount: price,
  currency,
  currency_symbol: currency === 'USD' ? '$' : 'RM',
  features_json: JSON.stringify(features),
});

test('new installs start in ringgit at RM 199 and RM 599, without the removed features', () => {
  const pk = defaultPackages(1);
  assert.deepEqual(pk.map((p) => [p.id, p.currency, p.currency_symbol, p.price_amount]), [
    ['pkg-free', 'MYR', 'RM', 0], ['pkg-club', 'MYR', 'RM', 199], ['pkg-event-pro', 'MYR', 'RM', 599],
  ]);
  const all = pk.flatMap((p) => JSON.parse(p.features_json));
  for (const gone of ['PHRF', 'layline', 'NMEA', 'Dual-band', 'branding']) assert.ok(!all.some((f: string) => f.includes(gone)), gone);
  for (const p of pk) assert.equal(migratePackageRow(p), null, `${p.id} needs nothing`);
});

test('a stored default still at its first dollar price moves to ringgit, features fixed', () => {
  const m = migratePackageRow(old('pkg-club', 49, ['Up to 60 boats', 'Automated IRC / PHRF corrected scoring', 'Live weather & wind layline overlays']))!;
  assert.deepEqual([m.currency, m.currency_symbol, m.price_amount], ['MYR', 'RM', 199]);
  assert.deepEqual(JSON.parse(m.features_json), ['Up to 60 boats', 'Automated IRC, ORC & Portsmouth corrected scoring']);
  const pro = migratePackageRow(old('pkg-event-pro', 149, ['Raw NMEA / AIS integration support', 'Custom club branding & sponsor logos', 'Dual-band LoRa mesh + cellular fallback', 'Priority support']))!;
  assert.deepEqual([pro.price_amount, JSON.parse(pro.features_json)], [599, ['Priority support']]);
});

test('a plan an admin repriced keeps its price; only the false features come off', () => {
  const m = migratePackageRow(old('pkg-club', 59, ['Live weather & wind layline overlays', 'Mine']))!;
  assert.deepEqual([m.currency, m.price_amount, JSON.parse(m.features_json)], ['USD', 59, ['Mine']]);
  assert.equal(migratePackageRow(old('pkg-club', 59, ['Mine'])), null);
  // Already moved: nothing to do (so it runs once)
  assert.equal(migratePackageRow(old('pkg-club', 199, ['Mine'], 'MYR')), null);
});

test('formatPrice: ringgit with a space, dollars without, zero is Free', () => {
  assert.equal(formatPrice(199, 'RM'), 'RM 199');
  assert.equal(formatPrice(49, '$'), '$49');
  assert.equal(formatPrice(0, 'RM'), 'Free');
  assert.equal(formatPrice(99), 'RM 99');
});
