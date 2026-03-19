import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'src/front-end/utils/**',
        'src/front-end/composables/**',
        'src/front-end/services/**',
        'src/back-end/**',
      ],
    },
    projects: [
      {
        plugins: [vue()],
        test: {
          name: 'renderer',
          environment: 'jsdom',
          include: ['tests/front-end/**/*.test.ts'],
          globals: true,
        },
        resolve: {
          alias: { '@': path.resolve(__dirname, './src') },
        },
      },
      {
        test: {
          name: 'node',
          environment: 'node',
          include: ['tests/back-end/**/*.test.ts'],
          globals: true,
        },
        resolve: {
          alias: { '@': path.resolve(__dirname, './src') },
        },
      },
    ],
  },
});
