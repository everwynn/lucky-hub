import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUrl } from '../../scripts/fetch.mjs';

test('buildUrl 生成 ssq 查询参数', () => {
  const url = new URL(buildUrl({ pageNo: 2, pageSize: 100 }));
  assert.equal(url.searchParams.get('name'), 'ssq');
  assert.equal(url.searchParams.get('pageNo'), '2');
  assert.equal(url.searchParams.get('pageSize'), '100');
  assert.equal(url.searchParams.get('systemType'), 'PC');
  assert.equal(url.origin, 'https://www.cwl.gov.cn');
});
