import { resolveOptions } from './options';
import { servePlugin } from './serve';
import { buildPlugin } from './build';

import type { Plugin } from 'vite';
import type { PluginShopifyAssetsOptions } from './options';

const shopifyAssets = (options: PluginShopifyAssetsOptions): Plugin[] => {
  const resolvedOptions = resolveOptions(options);

  return [buildPlugin(resolvedOptions), servePlugin(resolvedOptions)];
};

export type { PluginShopifyAssetsOptions };
export type { RenameFunc, Target } from './options';

export default shopifyAssets;
