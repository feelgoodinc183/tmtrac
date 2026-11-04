import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalNodeId, nodeNumFromId, sameNodeId } from '../src/utils/nodeId';

test('canonicalNodeId: "!" + 8 lowercase hex for Meshtastic ids', () => {
  assert.equal(canonicalNodeId(0xa1b2c3d4), '!a1b2c3d4');
  assert.equal(canonicalNodeId(0x1234), '!00001234');
  assert.equal(canonicalNodeId(0xffffffff), '!ffffffff');
  assert.equal(canonicalNodeId(-1), '!ffffffff', 'numbers are taken as uint32');
  assert.equal(canonicalNodeId('!A1B2C3D4'), '!a1b2c3d4');
  assert.equal(canonicalNodeId('a1b2c3d4'), '!a1b2c3d4');
  assert.equal(canonicalNodeId('0xA1B2C3D4'), '!a1b2c3d4');
  assert.equal(canonicalNodeId('  !b2c3d4 '), '!00b2c3d4');
});

test('canonicalNodeId: other ids are kept (trimmed), empty stays empty', () => {
  assert.equal(canonicalNodeId('!DEV-1A2B'), '!DEV-1A2B');
  assert.equal(canonicalNodeId('!TECHO-ABC123'), '!TECHO-ABC123');
  assert.equal(canonicalNodeId('phone-123456789'), 'phone-123456789');
  assert.equal(canonicalNodeId(''), '');
  assert.equal(canonicalNodeId(null), '');
  assert.equal(canonicalNodeId(undefined), '');
  assert.equal(canonicalNodeId(Number.NaN), '');
});

test('sameNodeId and nodeNumFromId', () => {
  assert.equal(sameNodeId('!A1B2C3D4', 'a1b2c3d4'), true);
  assert.equal(sameNodeId('!a1b2c3d4', '!a1b2c3d5'), false);
  assert.equal(sameNodeId(null, '!a1b2c3d4'), false);
  assert.equal(nodeNumFromId('!A1B2C3D4'), 0xa1b2c3d4);
  assert.equal(nodeNumFromId('!DEV-1A2B'), null);
});

import { clearLegacyTrackerIds, isLegacyPlaceholderNodeId } from '../src/utils/nodeId';

test('legacy placeholder tracker ids are cleared; real and phone ids are kept', () => {
  assert.equal(isLegacyPlaceholderNodeId('!TECHO-ABC123'), true);
  assert.equal(isLegacyPlaceholderNodeId('!TECHO-LIVE'), true);
  assert.equal(isLegacyPlaceholderNodeId('!USB01'), true);
  assert.equal(isLegacyPlaceholderNodeId('!a1b2c3d4'), false);
  assert.equal(isLegacyPlaceholderNodeId('!DEV-1A2B'), false);
  const boats = [
    { id: 'a', nodeId: '!TECHO-LIVE' },
    { id: 'b', nodeId: '!A1B2C3D4' },
    { id: 'c', nodeId: '!DEV-1A2B' },
    { id: 'd', nodeId: null },
  ];
  const r = clearLegacyTrackerIds(boats);
  assert.deepEqual(r.cleared.map((b) => b.id), ['a']);
  assert.deepEqual(r.boats.map((b) => b.nodeId), [null, '!A1B2C3D4', '!DEV-1A2B', null]);
  assert.equal(clearLegacyTrackerIds([{ nodeId: '!a1b2c3d4' }]).cleared.length, 0);
});
