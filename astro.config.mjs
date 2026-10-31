// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import vue from '@astrojs/vue';

const isCI = process.env.CI === 'true';

export default defineConfig({
  site: 'https://everwynn.github.io',
  base: isCI ? '/lucky-hub/' : '/',
  integrations: [tailwind(), vue()],
  output: 'static',
});
