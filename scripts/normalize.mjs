/** 官网 result[] → 本项目 Draw 结构 */
export function normalizeDraw(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('开奖记录不是对象');
  const code = String(raw.code ?? '').trim();
  const date = String(raw.date ?? '').slice(0, 10);
  const red = String(raw.red ?? '')
    .split(',')
    .map((s) => Number.parseInt(s.trim(), 10));
  const blue = Number.parseInt(String(raw.blue ?? '').trim(), 10);
  return { code, date, red, blue };
}

/** 按期号合并：远端覆盖本地，结果按期号升序 */
export function mergeDraws(existing, incoming) {
  const map = new Map();
  for (const d of existing ?? []) map.set(d.code, d);
  for (const d of incoming ?? []) map.set(d.code, d);
  return [...map.values()].sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
}
