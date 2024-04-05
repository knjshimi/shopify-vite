# Vite Plugin Shopify Assets

<a href="https://www.npmjs.com/package/vite-plugin-shopify-assets"><img src="https://img.shields.io/npm/dt/vite-plugin-shopify-assets" alt="Total Downloads"></a>
<a href="https://www.npmjs.com/package/vite-plugin-shopify-assets"><img src="https://img.shields.io/npm/v/vite-plugin-shopify-assets" alt="Latest Stable Version"></a>
<a href="https://www.npmjs.com/package/vite-plugin-shopify-assets"><img src="https://img.shields.io/npm/l/vite-plugin-shopify-assets" alt="License"></a>

Created to be used alongside [vite-plugin-shopify](https://github.com/barrel/shopify-vite/tree/main/packages/vite-plugin-shopify), for those who need to watch static assets, keeping the Shopify theme assets folder always in sync.

This plugin is not yet stable, so _use at your own risk_.

Please give your feedback, and send me any questions. A better documentation is in progress.

## Installation

```shell
npm i -D vite-plugin-shopify-assets # npm
yarn add -D vite-plugin-shopify-assets # yarn
```

## Example usage

Assuming the below folder structure:

```text
my-shopify-project/
  ├── frontend/
  │   ├── assets/
  │   │   ├── fonts/
  │   │   │   └── static-font.woff
  │   │   ├── images/
  │   │   │   └── static-image.png
  │   │   ├── other/
  │   │   │   └── static-script-1.js
  │   │   └── static-script-2.js
  │   └── icons/
  │       └── icon-arrow.svg
  └── theme/
      ├── assets/
      ├── config/
      ├── layout/
      ├── locales/
      ├── sections/
      ├── snippets/
      └── templates/
```

In your `vite.config.js` file, you need to import the plugin and set it up with some configuration options:

```js
// vite.config.js
import shopify from 'vite-plugin-shopify';
import shopifyAssets from 'vite-plugin-shopify-assets';

export default defineConfig({
  plugins: [
    // This plugin
    shopifyAssets({
      themeRoot: 'theme',
      publicDir: 'frontend/assets',
      targets: [
        // when targets are passed as strings, all target options use the default
        // Note: target sources are relative to publicDir
        'fonts/*.{woff,woff2,ttf,otf,svg}',
        'images/*.{jpg,jpeg,gif,png,webp,svg}',

        // when targets are passed as objects, you can specify options
        {
          // glob pattern for source assets
          src: '**/*.{js,liquid,text,md,json,css}',

          // glob patterns to ignore
          ignore: ['other-ignored/**/*', 'icons/**/*', 'images/**/*'],
        },

        {
          // when a non-static asset (eg: used in js) also needs to be copied as a static asset,
          // you can tell the plugin to find it elsewhere. Note: relative to publicDir
          src: '../icons/icon-*.svg',

          // the default destination is {themeRoot}/assets, but you can specify
          // a different source (relative to themeRoot)
          dest: 'snippets',

          // rename function, useful for making liquid snippets out of svg files for example
          rename: (file, ext, src) => `${file}.liquid`,

          // cleanMatch - USE WITH CAUTION:
          // glob pattern, relative to the dest folder, of files that should be cleaned/deleted
          // useful when the dest folder is not the default `{themeRoot}/assets` to avoid unused asset files
          // being shipped with the theme
          //
          // Only use this when you are certain that ALL files matching the pattern
          // have their source elsewhere and thus can be safely deleted
          cleanMatch: 'icon-*.liquid',
        },
      ],
    }),

    // Barrel's vite-plugin-shopify
    shopify({
      themeRoot: 'theme',
      sourceCodeDir: 'frontend',
    }),
  ],
});
```

It works on dev, watch and build.

```json
{
  "name": "my-project",
  "scripts": {
    "dev": "vite",
    "watch": "vite build --watch",
    "build": "vite build"
  }
}
```

```shell
npm run dev
# yarn watch
```

## Acknowledgements

- [Vite Plugin Shopify](https://github.com/barrel/shopify-vite/tree/main/packages/vite-plugin-shopify) by [Barrel/NY](https://github.com/barrel) (Thanks for the amazing plugins!)
- [Vite Plugin Static Copy](https://github.com/sapphi-red/vite-plugin-static-copy)
