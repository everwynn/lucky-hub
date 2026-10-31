import { copyFile, mkdir } from 'node:fs/promises';

export const DATA_FILES = ['draws.json', 'meta.json', 'health.json'];

/**
 * data/ → public/data/：静态站只能通过 public/ 目录把文件暴露给浏览器，
 * 而 data/ 才是唯一数据源，所以每次 dev / build / 本地抓取后都要复制一次。
 */
export async function syncData() {
  await mkdir('public/data', { recursive: true });
  for (const name of DATA_FILES) {
    try {
      await copyFile(`data/${name}`, `public/data/${name}`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}

// 直接 `node scripts/sync-data.mjs`（npm run dev / build 里的用法）时保留原有输出
if (process.argv[1]?.endsWith('sync-data.mjs')) {
  await syncData();
  console.log(`[sync-data] copied: ${DATA_FILES.join(', ')}`);
}
