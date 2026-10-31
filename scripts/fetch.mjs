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

const HEALTH_PATH = 'data/health.json';

/**
 * 把 fetch 的底层原因（ENOTFOUND / ETIMEDOUT / 证书错误…）拼进错误信息。
 * 只看得到 "fetch failed" 时无法判断是 DNS 还是被墙，Actions 日志里很难排查。
 */
export function describeError(error) {
  const message = error?.message ?? String(error);
  const cause = error?.cause;
  if (!cause) return message;
  const code = cause.code ? `${cause.code}: ` : '';
  return `${message}｜${code}${cause.message ?? String(cause)}`;
}

/**
 * 纯函数：抓取失败后 health.json 该写什么；返回 null 表示无需写盘。
 * 连续同样的失败不重复写，否则每次定时任务都会因时间戳变化产生一次空提交。
 */
export function nextHealthOnError(previous, error, now = new Date().toISOString()) {
  const message = describeError(error);
  if (previous?.status === 'error' && previous?.message === message) return null;
  return {
    status: 'error',
    lastRunAt: now,
    lastSuccessAt: previous?.lastSuccessAt,
    message,
  };
}

/**
 * 纯函数：上次是 error、这次成功但没有新增期号时，把状态改回 ok；返回 null 表示无需写盘。
 * 只在需要清除失败状态时才写，保证正常日子一个字节都不动。
 */
export function nextHealthOnNoChange(previous, total, now = new Date().toISOString()) {
  if (previous?.status !== 'error') return null;
  return {
    status: 'ok',
    lastRunAt: now,
    lastSuccessAt: now,
    added: 0,
    total,
    previousMessage: previous.message,
  };
}

/** 抓取失败时落盘：/about 靠这个文件判断“最近一次是否成功” */
async function recordHealthError(error) {
  const next = nextHealthOnError(await readJsonSafe(HEALTH_PATH), error);
  if (next) await writeJson(HEALTH_PATH, next);
}

/** 恢复成功时清掉残留的失败状态 */
async function clearHealthErrorIfAny(total) {
  const next = nextHealthOnNoChange(await readJsonSafe(HEALTH_PATH), total);
  if (next) await writeJson(HEALTH_PATH, next);
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
  const previous = await readJsonSafe(HEALTH_PATH);
  await writeJson(HEALTH_PATH, {
    status: 'ok',
    lastRunAt: now,
    lastSuccessAt: now,
    added,
    total: merged.length,
    previousMessage: previous?.message,
  });
  return { added, total: merged.length, lastCode: latest?.code ?? '' };
}

/**
 * 抓取失败也要先落盘再抛：否则 /about 会一直显示上一次的“成功”，
 * 数据停更了也看不出来（GitHub 的海外 runner 经常连不上官网）。
 */
export async function run(options = {}) {
  try {
    return await runOnce(options);
  } catch (error) {
    try {
      await recordHealthError(error);
    } catch (healthError) {
      // health 写不进去不能掩盖真正的失败原因
      console.error(`[fetch] 写入 health.json 失败：${healthError.message}`);
    }
    throw error;
  }
}

async function runOnce({ maxPages = 100, delayMs = 300 } = {}) {
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
  // 唯一的例外：上次抓取是失败的，这次要能把状态清回 ok。
  if (added === 0) {
    await clearHealthErrorIfAny(merged.length);
    return { added: 0, total: merged.length, lastCode: merged[merged.length - 1]?.code ?? '' };
  }

  return writeDataset(merged, { added });
}

const invokedDirectly = process.argv[1]?.endsWith('fetch.mjs');
if (invokedDirectly) {
  run()
    .then((r) => console.log(`[fetch] 完成：新增 ${r.added} 期，累计 ${r.total} 期，最新 ${r.lastCode}`))
    .catch((e) => {
      console.error(`[fetch] 失败：${describeError(e)}`);
      process.exitCode = 1;
    });
}
