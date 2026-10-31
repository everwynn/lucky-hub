import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDraw, validateAll } from '../../scripts/validate.mjs';

const ok = { code: '2026124', date: '2026-10-29', red: [3, 11, 17, 22, 23, 29], blue: 9 };

test('合法记录无错误', () => {
  assert.deepEqual(validateDraw(ok), []);
});

test('红球数量/越界/重复被拦截', () => {
  assert.match(validateDraw({ ...ok, red: [1, 2, 3, 4, 5] })[0], /红球数量/);
  assert.match(validateDraw({ ...ok, red: [1, 2, 3, 4, 5, 34] })[0], /红球越界/);
  assert.match(validateDraw({ ...ok, red: [1, 2, 3, 4, 5, 5] })[0], /红球重复/);
});

test('蓝球/期号/日期被拦截', () => {
  assert.match(validateDraw({ ...ok, blue: 17 })[0], /蓝球/);
  assert.match(validateDraw({ ...ok, code: '202612' })[0], /期号/);
  assert.match(validateDraw({ ...ok, date: '2026/10/29' })[0], /日期/);
});

test('validateAll 拦截重复期号与非递增新增', () => {
  const rows = [ok, ok];
  assert.match(validateAll(rows).join('\n'), /期号重复/);
  assert.match(validateAll([ok], { minNewCode: '2026125' }).join('\n'), /期号未递增/);
});
