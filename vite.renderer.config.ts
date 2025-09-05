import type { ConfigEnv, UserConfig } from 'vite';
import { defineConfig } from 'vite';
import { resolve } from 'path';

import vuePlugin from '@vitejs/plugin-vue';

// https://vitejs.dev/config
export default defineConfig((env) => {
  const forgeEnv = env as ConfigEnv<'renderer'>;
  const { root, mode, forgeConfigSelf } = forgeEnv;
  const name = forgeConfigSelf.name ?? '';

  return {
    root,
    mode,
    base: './',
    build: {
      outDir: `.vite/renderer/${name}`,
    },
    plugins: [
      vuePlugin(),
    ],
    resolve: {
      preserveSymlinks: true,
      alias: {
        '@': resolve(__dirname, 'src')
      }
    },
    clearScreen: false,
  } as UserConfig;
});