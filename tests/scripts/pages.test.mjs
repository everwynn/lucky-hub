import test from 'node:test';
import assert from 'node:assert/strict';
import { collectAllPages } from '../../scripts/lib/pages.mjs';

const mk = (n, from) =>
  Array.from({ length: n }, (_, i) => ({ code: String(1000000 + from + i), red: [1, 2, 3, 4, 5, 6], blue: 1 }));

test('collectAllPages 翻到短页即停', async () => {
  const pages = { 1: mk(3, 0), 2: mk(3, 3), 3: mk(1, 6) };
  const calls = [];
  const draws = await collectAllPages({
    fetchPage: async (pageNo) => {
      calls.push(pageNo);
      return pages[pageNo] ?? [];
    },
    delayMs: 0,
  });
  assert.deepEqual(calls, [1, 2, 3]);
  assert.equal(draws.length, 7);
});

test('collectAllPages 遵守 maxPages 上限', async () => {
  const draws = await collectAllPages({
    fetchPage: async () => mk(3, 0),
    delayMs: 0,
    maxPages: 2,
  });
  assert.equal(draws.length, 6);
});
