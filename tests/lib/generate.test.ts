import test from 'node:test';
import assert from 'node:assert/strict';
import { generateTicket, countRecent, weightRatio, type Draw } from '../../src/lib/generate.ts';

/** 可复现的伪随机源 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const draws: Draw[] = Array.from({ length: 10 }, (_, i) => ({
  code: String(2026001 + i),
  date: '2026-01-01',
  red: [1, 2, 3, 4, 5, 6],
  blue: 1,
}));

test('两种模式都产出合法的 6 红 + 1 蓝', () => {
  for (const mode of ['uniform', 'weighted'] as const) {
    const rand = mulberry32(1);
    for (let i = 0; i < 200; i++) {
      const t = generateTicket(draws, { mode, rand });
      assert.equal(t.red.length, 6);
      assert.equal(new Set(t.red).size, 6, '红球不得重复');
      assert.ok(t.red.every((n) => Number.isInteger(n) && n >= 1 && n <= 33), '红球越界');
      assert.ok(Number.isInteger(t.blue) && t.blue >= 1 && t.blue <= 16, '蓝球越界');
      assert.deepEqual([...t.red].sort((a, b) => a - b), t.red, '红球须升序');
    }
  }
});

test('同一随机源下结果可复现', () => {
  const a = generateTicket(draws, { mode: 'uniform', rand: mulberry32(42) });
  const b = generateTicket(draws, { mode: 'uniform', rand: mulberry32(42) });
  assert.deepEqual(a.red, b.red);
  assert.equal(a.blue, b.blue);
});

test('countRecent 只统计窗口内的期数', () => {
  const { red } = countRecent(draws, 4);
  assert.equal(red.get(1), 4);
  assert.equal(red.get(7), undefined);
});

test("countRecent 传 'all' 时统计全部历史", () => {
  const { red } = countRecent(draws, 'all');
  assert.equal(red.get(1), draws.length);
});

test('三档窗口都产出合法号码且回填了选择的档位', () => {
  for (const window of [30, 100, 'all'] as const) {
    const t = generateTicket(draws, { mode: 'weighted', window, rand: mulberry32(11) });
    assert.equal(t.window, window);
    assert.equal(t.red.length, 6);
    assert.equal(new Set(t.red).size, 6);
    assert.ok(Number.isInteger(t.blue) && t.blue >= 1 && t.blue <= 16);
  }
});

test('weightRatio：无数据为 1，有数据时大于 1', () => {
  assert.equal(weightRatio([], 30), 1);
  // 10 期全是 1..6：最多 10 次，其余 0 次 → (10+1)/(0+1) = 11
  assert.equal(weightRatio(draws, 30), 11);
});

test('加权模式下高频号被选中次数明显更多', () => {
  const hot: Draw[] = Array.from({ length: 50 }, (_, i) => ({
    code: String(2026001 + i),
    date: '2026-01-01',
    red: [7, 8, 9, 10, 11, 12],
    blue: 1,
  }));
  const rand = mulberry32(7);
  let hotHit = 0;
  const rounds = 3000;
  for (let i = 0; i < rounds; i++) {
    if (generateTicket(hot, { mode: 'weighted', window: 30, rand }).red.includes(7)) hotHit++;
  }
  // 6 个号全是高频号，等概率下期望命中率约 6/33 = 18%；加权后应显著更高
  assert.ok(hotHit / rounds > 0.5, `加权命中率过低: ${(hotHit / rounds).toFixed(3)}`);
});
