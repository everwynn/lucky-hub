import type { Draw } from './generate';

/** 从站点根路径拉取全量开奖数据（构建时由 sync-data 复制到 public/data/） */
export async function loadDraws(): Promise<Draw[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/draws.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`加载开奖数据失败（HTTP ${res.status}）`);
  const raw = (await res.json()) as unknown;
  if (!Array.isArray(raw) || raw.length === 0) throw new Error('开奖数据为空');
  return raw as Draw[];
}
