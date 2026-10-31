import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildUrl,
  describeError,
  nextHealthOnError,
  nextHealthOnNoChange,
} from '../../scripts/fetch.mjs';

/** 构造一个与 Node 18+ fetch 失败同形状的错误 */
function networkError(code = 'ENOTFOUND', detail = 'getaddrinfo ENOTFOUND www.cwl.gov.cn') {
  const error = new TypeError('fetch failed');
  error.cause = Object.assign(new Error(detail), { code });
  return error;
}

test('buildUrl 生成 ssq 查询参数', () => {
  const url = new URL(buildUrl({ pageNo: 2, pageSize: 100 }));
  assert.equal(url.searchParams.get('name'), 'ssq');
  assert.equal(url.searchParams.get('pageNo'), '2');
  assert.equal(url.searchParams.get('pageSize'), '100');
  assert.equal(url.searchParams.get('systemType'), 'PC');
  assert.equal(url.origin, 'https://www.cwl.gov.cn');
});

test('describeError 把底层 cause 的 code 拼进信息', () => {
  const text = describeError(networkError());
  assert.match(text, /fetch failed/);
  assert.match(text, /ENOTFOUND/);
  assert.match(text, /www\.cwl\.gov\.cn/);
});

test('describeError 无 cause 时退回 message', () => {
  assert.equal(describeError(new Error('校验失败')), '校验失败');
});

test('nextHealthOnError 首次失败写 error，并保留上次成功时间', () => {
  const got = nextHealthOnError(
    { status: 'ok', lastSuccessAt: '2026-10-31T00:00:00.000Z' },
    networkError(),
    '2026-11-01T00:00:00.000Z',
  );
  assert.equal(got.status, 'error');
  assert.equal(got.lastRunAt, '2026-11-01T00:00:00.000Z');
  assert.equal(got.lastSuccessAt, '2026-10-31T00:00:00.000Z');
  assert.match(got.message, /ENOTFOUND/);
});

test('nextHealthOnError 相同失败不重复写盘，避免每天产生空提交', () => {
  const first = nextHealthOnError({ status: 'ok' }, networkError(), 'T1');
  assert.equal(nextHealthOnError(first, networkError(), 'T2'), null);
});

test('nextHealthOnError 失败原因变化时仍要写盘', () => {
  const first = nextHealthOnError({ status: 'ok' }, networkError(), 'T1');
  const timeout = networkError('ETIMEDOUT', 'Connect Timeout Error');
  const next = nextHealthOnError(first, timeout, 'T2');
  assert.notEqual(next, null);
  assert.match(next.message, /ETIMEDOUT/);
});

test('nextHealthOnNoChange 上次失败时恢复为 ok', () => {
  const got = nextHealthOnNoChange({ status: 'error', message: 'boom' }, 2082, 'T');
  assert.equal(got.status, 'ok');
  assert.equal(got.total, 2082);
  assert.equal(got.added, 0);
  assert.equal(got.previousMessage, 'boom');
});

test('nextHealthOnNoChange 上次成功或无记录时不动文件', () => {
  assert.equal(nextHealthOnNoChange({ status: 'ok' }, 2082), null);
  assert.equal(nextHealthOnNoChange(null, 2082), null);
});
