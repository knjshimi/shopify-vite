import { defineConfig } from 'vite';
import shopify from 'vite-plugin-shopify';
import pageReload from 'vite-plugin-page-reload';
import shopifyAssets from 'vite-plugin-shopify-assets';
import { resolve } from 'node:path';

export default defineConfig({
  clearScreen: false,
  resolve: {
    alias: {
      '@@': resolve('frontend/scripts'),
      '@modules': resolve('frontend/modules'),
    },
  },
  plugins: [
    shopifyAssets({
      themeRoot: 'theme',
      publicDir: 'frontend/assets',
      silent: false,
      targets: [
        'fonts/*.{woff,woff2,ttf,otf,svg}',
        'images/*.{jpg,jpeg,gif,png,webp,svg}',
        {
          src: '**/*.{js,liquid,text,md,json,css}',
          ignore: ['other-ignored/**/*', 'icons/**/*', 'images/**/*'],
        },
        {
          src: '../icons/icon-*.svg',
          dest: 'snippets',
          rename: (file, ext, src) => `${file}.liquid`,
          cleanMatch: 'icon-*.liquid',
        },
      ],
    }),
    shopify({
      themeRoot: 'theme',
      sourceCodeDir: 'frontend',
      snippetFile: 'vite.liquid',
      additionalEntrypoints: [
        'frontend/foo.ts',
        'frontend/bar.ts',
        'frontend/modules/**/*.ts',
        'frontend/scripts/**/*.js',
        'frontend/styles/sections/*.scss',
      ],
    }),
    pageReload('theme.update', {
      delay: 1600,
    }),
  ],
  build: {
    sourcemap: false,
  },
});
