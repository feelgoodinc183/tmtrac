// Results files: CSV that survives commas, quotes and formulas, and series columns matched by race.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { csvBlob, csvCell, csvRows, csvTextCell } from '../src/services/csv';
import { calculateSeriesStandings, exportToSailwaveCsv, scoreForRace } from '../src/services/scoringService';
import { BoatRaceResult, CompletedRace } from '../src/types/regatta';

test('csvCell quotes everything and doubles quotes', () => {
  assert.equal(csvCell('Alpha, "the fast one"'), '"Alpha, ""the fast one"""');
  assert.equal(csvCell(3.5), '"3.5"');
  assert.equal(csvCell(undefined), '""');
  assert.equal(csvCell('line\nbreak'), '"line\nbreak"');
});

test('csvTextCell stops typed text being run as a formula', () => {
  assert.equal(csvTextCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
  for (const lead of ['+', '-', '@']) assert.equal(csvTextCell(`${lead}1`), `"'${lead}1"`);
  assert.equal(csvTextCell('MAS #12'), '"MAS #12"', 'a # stays in the cell');
  assert.equal(csvTextCell('Ægir'), '"Ægir"');
});

test('csvRows uses CRLF; csvBlob starts with a byte-order mark', async () => {
  assert.equal(csvRows([['"a"', '"b"'], ['"1"', '"2"']]), '"a","b"\r\n"1","2"\r\n');
  const bytes = new Uint8Array(await csvBlob('x').arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf]);
});

const result = (sail: string, cls: string, rank: number, status: BoatRaceResult['status'] = 'FINISHED', name = sail): BoatRaceResult => ({
  boatId: `b-${sail}`, boatName: name, sailNumber: sail, class: cls, handicapSystem: 'IRC', handicapRating: 1, skipper: 'S',
  status, elapsedSeconds: 600, correctedSeconds: 600, rank, rrsPoints: status === 'FINISHED' ? rank : 4, markRoundings: [],
});
const race = (id: string, n: number, raceClass: string, results: BoatRaceResult[]): CompletedRace => ({ id, raceNumber: n, raceTitle: `Race ${n}`, raceClass, completedAt: n, results });

test('Sailwave CSV: scores sit under their own race, with codes, and names cannot run formulas', () => {
  const races = [
    race('r1', 1, 'Class 1', [result('11', 'Class 1', 1, 'FINISHED', '=Alpha'), result('22', 'Class 1', 2)]),
    // A Class 2 race the standings for Class 1 leave out; a list filtered differently used to shift columns
    race('r2', 2, 'Class 2', [result('11', 'Class 1', 1), result('99', 'Class 2', 1)]),
    race('r3', 3, 'Class 1', [result('11', 'Class 1', 3, 'DNF'), result('22', 'Class 1', 1)]),
  ];
  const standings = calculateSeriesStandings(races, [], 'Class 1', 'NONE');
  // The Results window passed every race with a Class 1 boat in it, R2 included
  const lines = exportToSailwaveCsv('Series', 'Class 1', standings, races).trim().split('\r\n');
  assert.equal(lines[0], '"Rank","Boat","SailNo","Class","Rating","HelmName","R1","R2","R3","Total","Nett"');
  const alpha = lines.find((l) => l.includes('"11"'))!;
  assert.ok(alpha.startsWith('"2","\'=Alpha","11","Class 1"'), alpha);
  assert.ok(alpha.includes('"1","","4 DNF"'), `R1, nothing for R2, R3 with its code: ${alpha}`);
  // A race this boat has no score in stays empty instead of taking the next race's score
  const alphaStanding = standings.find((s) => s.sailNumber === '11')!;
  assert.equal(scoreForRace(alphaStanding, races[1]), undefined);
  assert.equal(scoreForRace(alphaStanding, races[2])!.status, 'DNF');
});
