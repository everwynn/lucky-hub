import type { Draw } from './types';
import { BLUE_MAX, RED_COUNT, RED_MAX, type WindowSpec } from './generate';

/**
 * 取窗口切片。window 为 'all' 或大于总期数时返回全部，
 * 调用方不需要为“数据不足”单独处理。
 */
function sliceWindow(draws: Draw[], window: WindowSpec): Draw[] {
  if (window === 'all' || window >= draws.length) return draws;
  return draws.slice(-window);
}

export interface FrequencyResult {
  counts: Map<number, number>;
  /** 窗口内实际期数（可能小于 window） */
  sampleSize: number;
  /** 每号理论出现次数 */
  expected: number;
  /** 二项分布标准差 sqrt(n·p·(1-p)) */
  sigma: number;
}

/** 每期从 poolSize 个号里开出 perDraw 个号时，统计每个号的出现次数 */
function frequency(rows: number[][], poolSize: number, perDraw: number): FrequencyResult {
  const counts = new Map<number, number>();
  for (let n = 1; n <= poolSize; n++) counts.set(n, 0);
  for (const row of rows) {
    for (const n of row) counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  const sampleSize = rows.length;
  const p = perDraw / poolSize;
  return {
    counts,
    sampleSize,
    expected: sampleSize * p,
    sigma: Math.sqrt(sampleSize * p * (1 - p)),
  };
}

export function redFrequency(draws: Draw[], window: WindowSpec): FrequencyResult {
  return frequency(sliceWindow(draws, window).map((d) => d.red), RED_MAX, RED_COUNT);
}

export function blueFrequency(draws: Draw[], window: WindowSpec): FrequencyResult {
  return frequency(sliceWindow(draws, window).map((d) => [d.blue]), BLUE_MAX, 1);
}

export interface OmissionRow {
  n: number;
  /** 距最近一次出现的期数：最新一期出现为 0，从未出现为总期数 */
  current: number;
  /** 全历史中最长的连续未出现期数 */
  max: number;
}

function omissionFor(draws: Draw[], poolSize: number, pick: (d: Draw) => number[]): OmissionRow[] {
  const rows: OmissionRow[] = [];
  for (let n = 1; n <= poolSize; n++) {
    // 当前遗漏：从最新一期往前数，遇到就停
    let current = 0;
    for (let i = draws.length - 1; i >= 0; i--) {
      if (pick(draws[i]).includes(n)) break;
      current++;
    }

    // 历史最大：正向扫描，记录每段连续未出现的长度
    let max = 0;
    let streak = 0;
    for (const d of draws) {
      if (pick(d).includes(n)) {
        if (streak > max) max = streak;
        streak = 0;
      } else {
        streak++;
      }
    }
    if (streak > max) max = streak;

    rows.push({ n, current, max });
  }
  return rows;
}

/** 遗漏按全历史计算，与窗口无关——遗漏的语义是“距上次开奖多少期” */
export function omissionStats(draws: Draw[]): { red: OmissionRow[]; blue: OmissionRow[] } {
  return {
    red: omissionFor(draws, RED_MAX, (d) => d.red),
    blue: omissionFor(draws, BLUE_MAX, (d) => [d.blue]),
  };
}

export interface Bucket {
  label: string;
  count: number;
}

export interface SumBin {
  from: number;
  to: number;
  count: number;
}

const MIN_SUM = 21; // 1+2+3+4+5+6
const MAX_SUM = 183; // 28+29+30+31+32+33

export function sumDistribution(
  draws: Draw[],
  window: WindowSpec,
  binSize = 10,
): { bins: SumBin[]; mean: number; sampleSize: number } {
  const slice = sliceWindow(draws, window);
  const binCount = Math.floor((MAX_SUM - MIN_SUM) / binSize) + 1;
  const bins: SumBin[] = Array.from({ length: binCount }, (_, i) => ({
    from: MIN_SUM + i * binSize,
    to: Math.min(MIN_SUM + (i + 1) * binSize - 1, MAX_SUM),
    count: 0,
  }));

  let total = 0;
  for (const d of slice) {
    const sum = d.red.reduce((a, b) => a + b, 0);
    total += sum;
    // 数据异常时 clamp，保证不越界写坏统计
    const idx = Math.min(Math.max(Math.floor((sum - MIN_SUM) / binSize), 0), binCount - 1);
    bins[idx].count++;
  }

  return { bins, mean: slice.length ? total / slice.length : 0, sampleSize: slice.length };
}

const SMALL_MAX = 16; // 1–16 为小，17–33 为大

export function oddEvenDistribution(draws: Draw[], window: WindowSpec): { buckets: Bucket[] } {
  const buckets: Bucket[] = Array.from({ length: RED_COUNT + 1 }, (_, odd) => ({
    label: `${odd}:${RED_COUNT - odd}`,
    count: 0,
  }));
  for (const d of sliceWindow(draws, window)) {
    const odd = d.red.filter((n) => n % 2 === 1).length;
    buckets[odd].count++;
  }
  return { buckets };
}

export function bigSmallDistribution(draws: Draw[], window: WindowSpec): { buckets: Bucket[] } {
  const buckets: Bucket[] = Array.from({ length: RED_COUNT + 1 }, (_, small) => ({
    label: `${small}:${RED_COUNT - small}`,
    count: 0,
  }));
  for (const d of sliceWindow(draws, window)) {
    const small = d.red.filter((n) => n <= SMALL_MAX).length;
    buckets[small].count++;
  }
  return { buckets };
}

export function zoneDistribution(draws: Draw[], window: WindowSpec): { combos: Bucket[]; sampleSize: number } {
  const slice = sliceWindow(draws, window);
  const map = new Map<string, number>();
  for (const d of slice) {
    const zone = [0, 0, 0];
    for (const n of d.red) {
      zone[n <= 11 ? 0 : n <= 22 ? 1 : 2]++;
    }
    const key = zone.join(':');
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  // 同频次时按标签字典序，保证输出稳定、测试可复现
  const combos = [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return { combos, sampleSize: slice.length };
}

export function consecutiveDistribution(draws: Draw[], window: WindowSpec): { buckets: Bucket[] } {
  const buckets: Bucket[] = Array.from({ length: RED_COUNT }, (_, pairs) => ({
    label: String(pairs),
    count: 0,
  }));
  for (const d of sliceWindow(draws, window)) {
    const sorted = [...d.red].sort((a, b) => a - b);
    let pairs = 0;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] - sorted[i - 1] === 1) pairs++;
    }
    buckets[pairs].count++;
  }
  return { buckets };
}

/**
 * 期际关系：本期与上一期比较。
 * 重号 = 与上期完全相同的号码个数；
 * 邻号 = 上期存在 n-1 或 n+1 的号码个数，不排除重号（两者是独立维度，可以重叠）。
 * 样本是窗口内相邻两期对：n 期数据得 n-1 对，窗口边界处那一对无法配对，直接舍弃。
 */
export function carryoverDistribution(
  draws: Draw[],
  window: WindowSpec,
): { repeat: Bucket[]; adjacent: Bucket[]; sampleSize: number } {
  const slice = sliceWindow(draws, window);
  const makeBuckets = () =>
    Array.from({ length: RED_COUNT + 1 }, (_, k) => ({ label: String(k), count: 0 }));
  const repeat = makeBuckets();
  const adjacent = makeBuckets();

  for (let i = 1; i < slice.length; i++) {
    const prev = new Set(slice[i - 1].red);
    const closed = slice[i].red.filter((n) => prev.has(n)).length;
    const near = slice[i].red.filter((n) => prev.has(n - 1) || prev.has(n + 1)).length;
    repeat[closed].count++;
    adjacent[near].count++;
  }

  return { repeat, adjacent, sampleSize: Math.max(0, slice.length - 1) };
}

