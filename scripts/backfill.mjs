import { collectAllPages } from './lib/pages.mjs';
import { fetchPageForBackfill, writeDataset } from './fetch.mjs';
import { mergeDraws } from './normalize.mjs';

// 官网接口按最新在前返回，且翻页边界可能重复；
// mergeDraws([], ...) 同时完成按期号去重与升序，满足 validateAll 的递增要求。
const collected = await collectAllPages({ fetchPage: fetchPageForBackfill, delayMs: 300, maxPages: 120 });
const draws = mergeDraws([], collected);
await writeDataset(draws);
console.log(`[backfill] 完成：${draws.length} 期，${draws[0]?.code} → ${draws.at(-1)?.code}`);
