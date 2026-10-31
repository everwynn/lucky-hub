import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDraw, mergeDraws } from '../../scripts/normalize.mjs';

test('normalizeDraw 清洗官网页字段', () => {
  const got = normalizeDraw({
    code: '2026124',
    date: '2026-10-29(四)',
    red: '03,11,17,22,23,29',
    blue: '09',
  });
  assert.deepEqual(got, {
    code: '2026124',
    date: '2026-10-29',
    red: [3, 11, 17, 22, 23, 29],
    blue: 9,
  });
});

test('mergeDraws 按期号去重、升序、远端覆盖', () => {
  const existing = [
    { code: '2026123', date: '2026-10-27', red: [1, 2, 3, 4, 5, 6], blue: 1 },
    { code: '2026124', date: '2026-10-29', red: [1, 2, 3, 4, 5, 6], blue: 1 },
  ];
  const incoming = [
    { code: '2026124', date: '2026-10-29', red: [3, 11, 17, 22, 23, 29], blue: 9 },
    { code: '2026125', date: '2026-10-31', red: [2, 4, 6, 8, 10, 12], blue: 3 },
  ];
  const got = mergeDraws(existing, incoming);
  assert.deepEqual(got.map((d) => d.code), ['2026123', '2026124', '2026125']);
  assert.deepEqual(got[1].red, [3, 11, 17, 22, 23, 29]);
  assert.equal(got.length, 3);
});
