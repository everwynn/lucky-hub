import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDraw, toShanghai } from '../../src/lib/format.ts';

const draw = { code: '2026124', date: '2026-10-29', red: [3, 11, 17, 22, 23, 29], blue: 9 };

test('formatDraw 输出补零号码', () => {
  assert.equal(formatDraw(draw), '03 11 17 22 23 29 | 09');
});

test('toShanghai 将 UTC 转为北京时间', () => {
  assert.equal(toShanghai('2026-10-30T13:50:00.000Z'), '2026-10-30 21:50');
});
