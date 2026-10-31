import { sleep } from './http.mjs';

/**
 * 逐页收集，直到返回条数小于上一页（或达到 maxPages）。
 * fetchPage(pageNo) 需返回该页的归一化记录数组。
 */
export async function collectAllPages({ fetchPage, startPage = 1, delayMs = 300, maxPages = 100 }) {
  const all = [];
  let pageSize = null;
  for (let pageNo = startPage; pageNo < startPage + maxPages; pageNo++) {
    const page = await fetchPage(pageNo);
    all.push(...page);
    if (pageSize === null) pageSize = page.length;
    if (page.length === 0) break;
    if (pageSize > 0 && page.length < pageSize) break;
    if (delayMs > 0) await sleep(delayMs);
  }
  return all;
}
