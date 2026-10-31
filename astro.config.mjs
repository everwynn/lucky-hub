// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import vue from '@astrojs/vue';

const isCI = process.env.CI === 'true';

/**
 * 本地抓取接口的处理函数。
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
async function handleLocalFetch(req, res) {
  /** @param {number} status @param {unknown} body */
  const reply = (status, body) => {
    res.statusCode = status;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(body));
  };

  if (req.method !== 'POST') return reply(405, { ok: false, message: '只接受 POST' });

  // 只允许本机调用：即使将来用 astro dev --host 暴露到局域网，也不接受外部触发。
  const ip = req.socket.remoteAddress ?? '';
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip)) {
    return reply(403, { ok: false, message: '只允许本机调用' });
  }

  const { run, describeError } = await import('./scripts/fetch.mjs');
  try {
    const result = await run();
    // 抓完立刻同步到 public/data/，页面刷新才能读到新数据
    const { syncData } = await import('./scripts/sync-data.mjs');
    await syncData();
    reply(200, { ok: true, ...result });
  } catch (error) {
    reply(500, { ok: false, message: describeError(error) });
  }
}

/**
 * 只在 `npm run dev` 生效的本地抓取接口。
 *
 * 为什么必须由本地 Node 代抓：福彩官网接口不返回 Access-Control-Allow-Origin，
 * 浏览器直连会被 CORS 拦死；静态站又没有服务端可以转发。
 *
 * `astro:server:setup` 只由 dev server 调用，`astro build` 永远不会注册它，
 * 所以生产站既没有这个接口，也不会因为它的存在而改变任何构建产物。
 */
function localFetchApi() {
  /** @type {import('astro').AstroIntegration} */
  const integration = {
    name: 'lucky-hub:local-fetch',
    hooks: {
      'astro:server:setup': ({ server }) => {
        server.middlewares.use('/api/local/fetch', handleLocalFetch);
      },
    },
  };
  return integration;
}

export default defineConfig({
  site: 'https://everwynn.github.io',
  base: isCI ? '/lucky-hub/' : '/',
  integrations: [tailwind(), vue(), localFetchApi()],
  output: 'static',
});
