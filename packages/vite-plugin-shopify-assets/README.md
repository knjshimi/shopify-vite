# Vite Plugin Shopify Assets

For those who need to watch static assets, keeping the target destination folder always in sync.

## Motivation

In my Shopify theme projects that use vite and [vite-plugin-shopify](https://github.com/barrel/shopify-vite/tree/main/packages/vite-plugin-shopify), I couldn't get [vite-plugin-static-copy](https://github.com/sapphi-red/vite-plugin-static-copy) to work for my needs. I needed a plugin to always keep static assets up to date in the `dist` folder, so [Shopify CLI](https://github.com/Shopify/cli) could upload them to the store theme straight away.

I haven't thoroughly tested this plugin, so _use at your own risk_.

Feedbacks are welcome.

## Installation

```shell
npm i -D vite-plugin-shopify-assets # npm
yarn add -D vite-plugin-shopify-assets # yarn
```

## Example usage

```js
// vite.config.js
import shopifyAssets from 'vite-plugin-shopify-assets';

export default defineConfig({
  plugins: [
    shopifyAssets({
      themeRoot: 'theme',
      publicDir: 'frontend/assets',
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
