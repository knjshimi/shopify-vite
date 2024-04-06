import { defineConfig } from 'vite';
import shopify from 'vite-plugin-shopify';
import shopifyAssets from 'vite-plugin-shopify-assets';

export default defineConfig({
  plugins: [shopify(), shopifyAssets()],
});
