// Seeded course profiles: every default has marks, and stored empty copies of a seed are repaired.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_COURSE_PROFILES, repairEmptySeededProfiles } from '../src/services/courseProfileService';
import { INITIAL_RACE_CLASSES } from '../src/services/initialData';
import { isStartMark, isFinishMark } from '../src/services/courseService';

test('every seeded course profile has a start line, a mark to round and a finish', () => {
  for (const p of DEFAULT_COURSE_PROFILES) {
    assert.ok(p.marks.length > 0, `${p.name} has no marks`);
    assert.ok(p.marks.some(isStartMark), `${p.name} has no start mark`);
    assert.ok(p.marks.some(isFinishMark), `${p.name} has no finish mark`);
    assert.ok(p.marks.some((m) => !isStartMark(m) && !isFinishMark(m)), `${p.name} has no course mark`);
  }
});

test('default classes link only to seeded profiles that have marks', () => {
  for (const c of INITIAL_RACE_CLASSES) {
    const profile = DEFAULT_COURSE_PROFILES.find((p) => p.id === c.courseProfileId);
    assert.ok(profile, `${c.name} links to a missing profile`);
    assert.equal(profile!.name, c.courseProfileName);
    assert.ok(profile!.marks.length > 0, `${c.name} links to an empty course`);
  }
});

test('repairEmptySeededProfiles refills an empty stored seed and leaves the rest alone', () => {
  const seed = DEFAULT_COURSE_PROFILES[0];
  const custom = { ...DEFAULT_COURSE_PROFILES[1], id: 'profile-mine', name: 'Mine' };
  const emptyCustom = { ...custom, id: 'profile-empty-mine', marks: [] };
  const stored = [{ ...seed, name: 'Renamed by officer', marks: [] }, custom, emptyCustom];

  const out = repairEmptySeededProfiles(stored);
  assert.notEqual(out, stored);
  assert.equal(out[0].name, 'Renamed by officer');
  assert.deepEqual(out[0].marks, seed.marks);
  assert.notEqual(out[0].marks, seed.marks, 'marks are copied, not shared');
  assert.equal(out[1], custom);
  assert.equal(out[2], emptyCustom, 'a profile that is not a seed is not touched');
});

test('repairEmptySeededProfiles returns the same array when nothing is empty', () => {
  const stored = DEFAULT_COURSE_PROFILES.slice();
  assert.equal(repairEmptySeededProfiles(stored), stored);
});
