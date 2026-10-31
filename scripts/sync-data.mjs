import { copyFile, mkdir } from 'node:fs/promises';

const FILES = ['draws.json', 'meta.json', 'health.json'];

await mkdir('public/data', { recursive: true });
for (const name of FILES) {
  try {
    await copyFile(`data/${name}`, `public/data/${name}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
console.log(`[sync-data] copied: ${FILES.join(', ')}`);
