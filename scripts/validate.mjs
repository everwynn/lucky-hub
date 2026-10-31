const CODE_RE = /^\d{7}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateDraw(d) {
  const errors = [];
  if (!d || typeof d !== 'object') return ['记录为空'];
  if (!CODE_RE.test(d.code ?? '')) errors.push(`期号格式非法: ${d.code}`);
  if (!DATE_RE.test(d.date ?? '') || Number.isNaN(Date.parse(d.date))) errors.push(`日期非法: ${d.date}`);
  const red = d.red;
  if (!Array.isArray(red) || red.length !== 6) {
    errors.push(`红球数量应为6: ${d.code}`);
  } else {
    if (red.some((n) => !Number.isInteger(n) || n < 1 || n > 33)) errors.push(`红球越界: ${d.code}`);
    if (new Set(red).size !== 6) errors.push(`红球重复: ${d.code}`);
  }
  if (!Number.isInteger(d.blue) || d.blue < 1 || d.blue > 16) errors.push(`蓝球非法: ${d.code}`);
  return errors;
}

export function validateAll(draws, { minNewCode } = {}) {
  const errors = [];
  const seen = new Set();
  let prev = '';
  for (const d of draws) {
    errors.push(...validateDraw(d));
    if (seen.has(d?.code)) errors.push(`期号重复: ${d?.code}`);
    seen.add(d?.code);
    if (d?.code <= prev) errors.push(`期号未递增: ${d?.code} 在 ${prev} 之后`);
    prev = d?.code;
  }
  if (minNewCode && draws.length > 0) {
    const max = draws[draws.length - 1].code;
    if (max < minNewCode && max !== minNewCode) {
      errors.push(`期号未递增: 最新 ${max} 小于本地最大 ${minNewCode}`);
    }
  }
  return errors;
}
