import test from 'node:test';
import assert from 'node:assert/strict';
import {
  redFrequency,
  blueFrequency,
  omissionStats,
  sumDistribution,
  oddEvenDistribution,
  bigSmallDistribution,
  zoneDistribution,
  consecutiveDistribution,
  carryoverDistribution,
} from '../../src/lib/stats.ts';
import type { Draw } from '../../src/lib/types.ts';

/**
 * 10 期手算样本。每个断言的具体数字都由这组数据人工推出，
 * 改动任何一个号码都要同步改断言。
 */
const draws: Draw[] = [
  { code: '2026001', date: '2026-01-01', red: [1, 2, 3, 4, 5, 6], blue: 1 },
  { code: '2026002', date: '2026-01-02', red: [3, 4, 5, 20, 21, 22], blue: 2 },
  { code: '2026003', date: '2026-01-03', red: [1, 7, 13, 19, 25, 31], blue: 3 },
  { code: '2026004', date: '2026-01-04', red: [11, 12, 13, 14, 15, 16], blue: 1 },
  { code: '2026005', date: '2026-01-05', red: [2, 9, 16, 23, 30, 33], blue: 4 },
  { code: '2026006', date: '2026-01-06', red: [18, 19, 20, 21, 22, 23], blue: 2 },
  { code: '2026007', date: '2026-01-07', red: [5, 10, 15, 20, 25, 30], blue: 5 },
  { code: '2026008', date: '2026-01-08', red: [4, 8, 12, 16, 24, 28], blue: 1 },
  { code: '2026009', date: '2026-01-09', red: [7, 14, 21, 28, 29, 30], blue: 6 },
  { code: '2026010', date: '2026-01-10', red: [2, 11, 17, 23, 32, 33], blue: 7 },
];

test('红球频次：计数正确、33 个号全部有键、期望与 σ 正确', () => {
  const r = redFrequency(draws, 'all');
  assert.equal(r.sampleSize, 10);
  assert.equal(r.counts.size, 33);
  assert.equal(r.counts.get(1), 2);
  assert.equal(r.counts.get(2), 3);
  assert.equal(r.counts.get(26), 0);
  assert.equal(r.counts.get(33), 2);
  assert.ok(Math.abs(r.expected - 60 / 33) < 1e-9);
  const p = 6 / 33;
  assert.ok(Math.abs(r.sigma - Math.sqrt(10 * p * (1 - p))) < 1e-9);
});

test('红球频次：window 取最近 N 期，超过总数时退化为全量', () => {
  const last3 = redFrequency(draws, 3);
  assert.equal(last3.sampleSize, 3);
  assert.equal(last3.counts.get(2), 1); // 只有第 10 期含 2
  assert.equal(last3.counts.get(1), 0); // 第 8–10 期都没有 1
  assert.equal(last3.counts.get(28), 2); // 第 8、9 期各一次

  const over = redFrequency(draws, 999);
  assert.equal(over.sampleSize, 10);
});

test('蓝球频次：16 个号、未出现的补 0', () => {
  const b = blueFrequency(draws, 'all');
  assert.equal(b.counts.size, 16);
  assert.equal(b.counts.get(1), 3);
  assert.equal(b.counts.get(2), 2);
  assert.equal(b.counts.get(7), 1);
  assert.equal(b.counts.get(8), 0);
  assert.ok(Math.abs(b.expected - 10 / 16) < 1e-9);
});

test('遗漏当前值：最新出现为 0、从未出现为总期数', () => {
  const { red, blue } = omissionStats(draws);
  const byRed = new Map(red.map((r) => [r.n, r]));
  assert.equal(byRed.get(33)!.current, 0); // 第 10 期出现
  assert.equal(byRed.get(30)!.current, 1); // 第 9 期出现
  assert.equal(byRed.get(1)!.current, 7); // 第 3 期出现，之后 7 期未出
  assert.equal(byRed.get(26)!.current, 10); // 从未出现
  assert.equal(byRed.size, 33);

  const byBlue = new Map(blue.map((r) => [r.n, r]));
  assert.equal(byBlue.size, 16);
  assert.equal(byBlue.get(8)!.current, 10); // 蓝 8–16 从未出现
  assert.equal(byBlue.get(7)!.current, 0);
});

test('遗漏历史最大值：按最长连续未出现区间计算', () => {
  const { red } = omissionStats(draws);
  const by = new Map(red.map((r) => [r.n, r]));
  assert.equal(by.get(1)!.max, 7); // 第 4–10 期连续 7 期
  assert.equal(by.get(2)!.max, 4); // 第 6–9 期连续 4 期
  assert.equal(by.get(33)!.max, 4); // 第 1–4 期、第 6–9 期各 4 期
  assert.equal(by.get(26)!.max, 10); // 从未出现，最长区间即全部
  assert.equal(by.get(30)!.max, 4); // 第 1–4 期连续 4 期（第 5 期就出了）
});

test('和值分布：17 箱、均值正确、首尾箱正确', () => {
  const s = sumDistribution(draws, 'all');
  assert.equal(s.sampleSize, 10);
  assert.equal(s.bins.length, 17);
  assert.equal(s.bins[0].from, 21);
  assert.equal(s.bins[0].to, 30);
  assert.equal(s.bins[16].from, 181);
  assert.equal(s.bins[16].to, 183);
  assert.equal(s.bins[0].count, 1); // 和值 21
  assert.equal(s.bins[7].count, 2); // 96、92
  assert.equal(s.bins[9].count, 2); // 113、118
  assert.equal(s.bins[10].count, 2); // 123、129
  assert.ok(Math.abs(s.mean - 95.3) < 1e-9);
});

test('和值分布：183 落入最后一箱且不越界', () => {
  const edge: Draw[] = [
    { code: '2026999', date: '2026-12-31', red: [28, 29, 30, 31, 32, 33], blue: 1 },
    { code: '2026998', date: '2026-12-30', red: [1, 2, 3, 4, 5, 6], blue: 1 },
  ];
  const s = sumDistribution(edge, 'all');
  assert.equal(s.bins[16].count, 1);
  assert.equal(s.bins[0].count, 1);
  assert.equal(s.bins.reduce((a, b) => a + b.count, 0), 2);
});

test('奇偶比：桶标签为 奇:偶，7 桶，总和等于期数', () => {
  const { buckets } = oddEvenDistribution(draws, 'all');
  assert.equal(buckets.length, 7);
  assert.deepEqual(
    buckets.map((b) => b.label),
    ['0:6', '1:5', '2:4', '3:3', '4:2', '5:1', '6:0'],
  );
  assert.equal(buckets[3].count, 7);
  assert.equal(buckets[0].count, 1); // 第 8 期全偶
  assert.equal(buckets[6].count, 1); // 第 3 期全奇
  assert.equal(buckets[4].count, 1); // 第 10 期 4 奇 2 偶
  assert.equal(buckets.reduce((a, b) => a + b.count, 0), 10);
});

test('大小比：桶标签为 小:大，小号上限 16', () => {
  const { buckets } = bigSmallDistribution(draws, 'all');
  assert.equal(buckets.length, 7);
  assert.equal(buckets[6].count, 2); // 第 1、4 期全小
  assert.equal(buckets[3].count, 4); // 第 2、3、5、7 期
  assert.equal(buckets[0].count, 1); // 第 6 期全大
  assert.equal(buckets[2].count, 2); // 第 9、10 期 2 小 4 大
  assert.equal(buckets.reduce((a, b) => a + b.count, 0), 10);
});

test('三区组合：每项三者之和为 6，按频次降序，总和等于期数', () => {
  const { combos, sampleSize } = zoneDistribution(draws, 'all');
  assert.equal(sampleSize, 10);
  for (const c of combos) {
    const sum = c.label.split(':').map(Number).reduce((a, b) => a + b, 0);
    assert.equal(sum, 6, `组合 ${c.label} 的个数之和不是 6`);
  }
  assert.equal(combos[0].label, '2:2:2'); // 第 3、7、8 期，3 次为最高
  assert.equal(combos[0].count, 3);
  assert.equal(combos[1].label, '2:1:3'); // 第 5、10 期
  assert.equal(combos[1].count, 2);
  assert.equal(combos.reduce((a, b) => a + b.count, 0), 10);
});

test('连号：按相邻差为 1 的对数统计，最多 5 对', () => {
  const { buckets } = consecutiveDistribution(draws, 'all');
  assert.equal(buckets.length, 6);
  assert.deepEqual(
    buckets.map((b) => b.label),
    ['0', '1', '2', '3', '4', '5'],
  );
  assert.equal(buckets[0].count, 4); // 第 3、5、7、8 期
  assert.equal(buckets[1].count, 1); // 第 10 期 32-33
  assert.equal(buckets[2].count, 1); // 第 9 期 28-29-30
  assert.equal(buckets[4].count, 1); // 第 2 期
  assert.equal(buckets[5].count, 3); // 第 1、4、6 期
  assert.equal(buckets.reduce((a, b) => a + b.count, 0), 10);
});

test('分布类函数都遵守窗口：最近 3 期', () => {
  assert.equal(sumDistribution(draws, 3).sampleSize, 3);
  assert.equal(oddEvenDistribution(draws, 3).buckets.reduce((a, b) => a + b.count, 0), 3);
  assert.equal(zoneDistribution(draws, 3).sampleSize, 3);
  assert.equal(consecutiveDistribution(draws, 3).buckets.reduce((a, b) => a + b.count, 0), 3);
});

test('期际关系：重号与邻号按相邻两期对统计', () => {
  const { repeat, adjacent, sampleSize } = carryoverDistribution(draws, 'all');
  assert.equal(sampleSize, 9); // 10 期得 9 对
  assert.deepEqual(
    repeat.map((b) => b.count),
    [3, 5, 0, 1, 0, 0, 0],
  );
  // 0 个：2→3、7→8、9→10；1 个：3→4、4→5、5→6、6→7、8→9；3 个：1→2 的 3,4,5
  assert.deepEqual(
    adjacent.map((b) => b.count),
    [1, 4, 2, 2, 0, 0, 0],
  );
  // 邻号不排除重号：1→2 的三个重号 3,4,5 同时与上期相邻，故记 3 个
});

test('期际关系：窗口内自比，单期样本为 0', () => {
  const five = carryoverDistribution(draws, 5);
  assert.equal(five.sampleSize, 4); // 5 期得 4 对
  assert.equal(five.repeat.reduce((a, b) => a + b.count, 0), 4);
  assert.equal(five.adjacent.reduce((a, b) => a + b.count, 0), 4);

  const one = carryoverDistribution(draws, 1);
  assert.equal(one.sampleSize, 0);
  assert.equal(one.repeat.reduce((a, b) => a + b.count, 0), 0);
});
