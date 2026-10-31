import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { getJson } from './lib/http.mjs';
import { collectAllPages } from './lib/pages.mjs';
import { normalizeDraw, mergeDraws } from './normalize.mjs';
import { validateAll } from './validate.mjs';

const BASE = 'https://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice';
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 lucky-hub/0.1',
  Accept: 'application/json, text/plain, */*',
  Referer: 'https://www.cwl.gov.cn/',
  'Accept-Language': 'zh-CN,zh;q=0.9',
};

export function buildUrl({ pageNo = 1, pageSize = 100 } = {}) {
  const p = new URLSearchParams({
    name: 'ssq',
    pageNo: String(pageNo),
    pageSize: String(pageSize),
    systemType: 'PC',
  });
  return `${BASE}?${p.toString()}`;
}

export async function readJsonSafe(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

export async function writeJson(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function fetchPage(pageNo) {
  const body = await getJson(buildUrl({ pageNo }), { headers: HEADERS });
  if (!body || body.state !== 0 || !Array.isArray(body.result)) {
    throw new Error(`接口异常: state=${body?.state} message=${body?.message}`);
  }
  return body.result.map(normalizeDraw);
}

/** 供 backfill 复用同一翻页实现 */
export const fetchPageForBackfill = fetchPage;

/**
 * 校验并把全量数据写入 data/ 三个文件。
 * 校验失败时不写 draws/meta，由调用方决定 health 的写法。
 */
export async function writeDataset(merged, { added = merged.length } = {}) {
  const errors = validateAll(merged);
  if (errors.length > 0) {
    throw new Error(`校验失败，未写入：${errors.slice(0, 5).join(' | ')}`);
  }
  const latest = merged[merged.length - 1];
  const now = new Date().toISOString();
  await writeJson('data/draws.json', merged);
  await writeJson('data/meta.json', {
    firstCode: merged[0]?.code ?? '',
    lastCode: latest?.code ?? '',
    lastDate: latest?.date ?? '',
    total: merged.length,
    updatedAt: now,
  });
  const previous = await readJsonSafe('data/health.json');
  await writeJson('data/health.json', {
    status: 'ok',
    lastRunAt: now,
    lastSuccessAt: now,
    added,
    total: merged.length,
    previousMessage: previous?.message,
  });
  return { added, total: merged.length, lastCode: latest?.code ?? '' };
}

export async function run({ maxPages = 100, delayMs = 300 } = {}) {
  const existing = (await readJsonSafe('data/draws.json')) ?? [];
  const incoming = [];
  incoming.push(...(await fetchPage(1)));

  // 第 1 页覆盖最近 100 期；若这批里最旧的一期仍比本地最新一期新，
  // 说明中间有断层（长时间未更新），需要翻页补齐，否则会静默留下缺口。
  const oldestFetched = incoming[incoming.length - 1]?.code ?? '';
  const newestLocal = existing[existing.length - 1]?.code ?? '';
  const needsFullScan = !newestLocal || oldestFetched > newestLocal;
  if (needsFullScan) {
    incoming.push(...(await collectAllPages({ fetchPage, startPage: 2, delayMs, maxPages })));
  }

  const merged = mergeDraws(existing, incoming);
  const added = merged.length - existing.length;

  // 没有新期号时一个字节都不写。否则 meta/health 的时间戳每次都会变，
  // 导致定时任务每个周期都产生一次无意义的 git 提交。
  if (added === 0) {
    return { added: 0, total: merged.length, lastCode: merged[merged.length - 1]?.code ?? '' };
  }

  try {
    return await writeDataset(merged, { added });
  } catch (error) {
    await writeJson('data/health.json', {
      status: 'error',
      lastRunAt: new Date().toISOString(),
      message: error.message,
    });
    throw error;
  }
}

const invokedDirectly = process.argv[1]?.endsWith('fetch.mjs');
if (invokedDirectly) {
  run()
    .then((r) => console.log(`[fetch] 完成：新增 ${r.added} 期，累计 ${r.total} 期，最新 ${r.lastCode}`))
    .catch((e) => {
      console.error(`[fetch] 失败：${e.message}`);
      process.exitCode = 1;
    });
}
