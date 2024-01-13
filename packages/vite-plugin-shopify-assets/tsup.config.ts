import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  target: 'node18.0.0',
  dts: true,
  format: ['esm'],
});
