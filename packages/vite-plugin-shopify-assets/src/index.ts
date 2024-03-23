import { resolveOptions } from './options.js';
import { servePlugin } from './serve.js';
import { buildPlugin } from './build.js';

import type { Plugin } from 'vite';
import type { PluginShopifyAssetsOptions } from './options.js';

const shopifyAssets = (options: PluginShopifyAssetsOptions): Plugin[] => {
  const resolvedOptions = resolveOptions(options);

  return [buildPlugin(resolvedOptions), servePlugin(resolvedOptions)];
};

export type { PluginShopifyAssetsOptions };
export type { RenameFunc, Target } from './options.js';

export default shopifyAssets;
