import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  target: 'node18.18.0',
  dts: true,
  format: ['esm'],
});
