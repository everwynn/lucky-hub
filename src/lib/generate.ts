export interface Draw {
  code: string;
  date: string;
  red: number[];
  blue: number;
}

export type Mode = 'weighted' | 'uniform';

/** 加权统计窗口：最近 30 期 / 最近 100 期 / 全部历史 */
export type WindowMode = 30 | 100 | 'all';

/** 统计函数的窗口入参：任意期数，或 'all' 表示全部历史（WindowMode 是它的子集） */
export type WindowSpec = number | 'all';

/**
 * 三档窗口的性格差异（基于 2082 期真实数据测算的最热:最冷权重比）：
 *   近 30 期 约 4.3:1 —— 灵敏，但追的大多是噪声
 *   近 100 期 约 2.5:1 —— 平衡，排名更稳，默认
 *   全部历史 约 1.3:1 —— 几乎等于纯随机，用来对照
 */
export const WINDOW_OPTIONS: { value: WindowMode; label: string }[] = [
  { value: 30, label: '近 30 期' },
  { value: 100, label: '近 100 期' },
  { value: 'all', label: '全部历史' },
];

export const DEFAULT_WINDOW: WindowMode = 100;

export interface GeneratedTicket {
  red: number[];
  blue: number;
  mode: Mode;
  window: WindowMode;
  /** 统计窗口内每个红球出现次数，供页面展示选号依据 */
  redCounts: Map<number, number>;
}

export const RED_MIN = 1;
export const RED_MAX = 33;
export const RED_COUNT = 6;
export const BLUE_MIN = 1;
export const BLUE_MAX = 16;
export const BLUE_COUNT = 1;

const RED_POOL: number[] = Array.from({ length: RED_MAX }, (_, i) => i + 1);
const BLUE_POOL: number[] = Array.from({ length: BLUE_MAX }, (_, i) => i + 1);

/** 从池子里不放回地抽 k 个，每次抽中概率正比于 weightOf(n) */
function pickWeighted(
  pool: number[],
  weightOf: (n: number) => number,
  k: number,
  rand: () => number,
): number[] {
  const rest = [...pool];
  const picked: number[] = [];
  while (picked.length < k && rest.length > 0) {
    const weights = rest.map(weightOf);
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rand() * total;
    let i = 0;
    while (i < rest.length - 1 && r >= weights[i]) {
      r -= weights[i];
      i++;
    }
    picked.push(rest.splice(i, 1)[0]);
  }
  return picked.sort((a, b) => a - b);
}

/** 等概率不放回抽 k 个 */
function pickUniform(pool: number[], k: number, rand: () => number): number[] {
  const rest = [...pool];
  const picked: number[] = [];
  while (picked.length < k && rest.length > 0) {
    const i = Math.floor(rand() * rest.length);
    picked.push(rest.splice(i, 1)[0]);
  }
  return picked.sort((a, b) => a - b);
}

/** 统计窗口内每个红球出现多少次；window 为 'all' 时统计全部历史 */
export function countRecent(draws: Draw[], window: WindowSpec): { red: Map<number, number> } {
  const slice = window === 'all' ? draws : draws.slice(-window);
  const red = new Map<number, number>();
  for (const d of slice) {
    for (const n of d.red) red.set(n, (red.get(n) ?? 0) + 1);
  }
  return { red };
}

/**
 * 当前窗口下最热与最冷号码的权重比。
 * 越大说明加权偏离纯随机越多；越接近 1 说明加权几乎不起作用。
 * 页面用它把“这一档到底偏了多少”直接摆给用户看。
 */
export function weightRatio(draws: Draw[], window: WindowSpec): number {
  const { red } = countRecent(draws, window);
  let min = Infinity;
  let max = 0;
  for (let n = RED_MIN; n <= RED_MAX; n++) {
    const c = red.get(n) ?? 0;
    if (c < min) min = c;
    if (c > max) max = c;
  }
  if (!Number.isFinite(min)) return 1;
  return (max + 1) / (min + 1);
}

/**
 * 生成一注：6 个红球（1..33）+ 1 个蓝球（1..16）。
 * weighted 模式下，近期出现次数越多的号权重越大；uniform 模式等概率。
 */
export function generateTicket(
  draws: Draw[],
  opts: { mode: Mode; window?: WindowMode; rand?: () => number } = { mode: 'uniform' },
): GeneratedTicket {
  const { mode, window = DEFAULT_WINDOW, rand = Math.random } = opts;
  const { red: redCounts } = countRecent(draws, window);

  const red =
    mode === 'weighted'
      ? pickWeighted(RED_POOL, (n) => (redCounts.get(n) ?? 0) + 1, RED_COUNT, rand)
      : pickUniform(RED_POOL, RED_COUNT, rand);
  const blue =
    mode === 'weighted'
      ? pickWeighted(BLUE_POOL, () => 1, BLUE_COUNT, rand)[0]
      : pickUniform(BLUE_POOL, BLUE_COUNT, rand)[0];

  return { red, blue, mode, window, redCounts };
}
