import { basename, dirname, join, relative, resolve } from 'node:path';
import { unlink, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

import fg from 'fast-glob';
import { normalizePath } from 'vite';

import { VITE_MANIFEST } from './constants.js';
import { copyAllAssetMap, getFilesInManifest, logEvent, logWarn, logWarnConsole, renameFile } from './utils.js';

import type { Logger, Manifest, Plugin, ResolvedConfig, UserConfig } from 'vite';
import type { ResolvedTarget, ResolvedPluginShopifyAssetsOptions } from './options.js';

export type AssetMap = Map<string, ResolvedTarget>;

export const buildPlugin = ({
  publicDir,
  themeRoot,
  themeAssetsDir,
  targets,
  onBuild,
  onWatch,
  silent,
}: ResolvedPluginShopifyAssetsOptions): Plugin => {
  let logger: Logger;
  let clean: boolean;
  let manifestFile: string | undefined;
  const currentDir = resolve();

  /**
   * A map with all the watched source asset files (keys), and their corresponding resolved target (values).
   */
  const assetMap: AssetMap = new Map();

  /**
   * A set of all asset directories to watch, based on publicDir.
   */
  const assetDirSet = new Set<string>();

  /**
   * A set of all asset destination paths to avoid duplicates.
   */
  const assetDestSet = new Set<string>();

  /**
   * A set of all asset files (name and extension) to make sure we don't delete them.
   */
  const assetFilesSet = new Set<string>();

  return {
    name: 'vite-plugin-shopify-assets:build',
    apply: 'build',

    config: (_config: UserConfig): UserConfig => {
      if (_config.build?.copyPublicDir === true) {
        logWarnConsole('Vite config.build.copyPublicDir is enabled, but it will be ignored.');
      }

      if (typeof _config?.publicDir !== 'undefined') {
        const relativePublicDir = relative(currentDir, publicDir);

        if (_config?.publicDir !== false) {
          logWarnConsole(
            `Your vite config.publicDir option is set to "${_config.publicDir}", but it will be ignored - Please set this in the plugin options instead. Using: ${relativePublicDir}. `,
          );
        }
      }

      if (!existsSync(publicDir)) {
        throw new Error(
          `[shopify-assets] publicDir does not exist: "${publicDir}". Either create it or set the correct path in plugin options.`,
        );
      }

      // Set the `clean` variable to check if we should emptyOutDir (must be manually)
      //
      // TODO: we probably need to check if themeAssetsDir (outDir) is inside
      // themeRoot(root maybe ?) - if it is not, we should not clean it on build.
      // That will mimic Vite's default behaviour for emptyOutDir.
      //
      // https://vitejs.dev/config/build-options.html#build-emptyoutdir
      clean = _config?.build?.emptyOutDir !== false;

      return {
        publicDir,
        build: {
          // We cannot let vite copy files because directories won't be flattened
          // and that's incompatible with Shopify theme structures.
          copyPublicDir: false,

          // We cannot let vite empty the outDir because it will delete our assets
          // We need to force disable it (we have a special variable for that: `clean`).
          emptyOutDir: false,
        },
      };
    },

    configResolved(_config: ResolvedConfig): void {
      logger = _config.logger;

      // Users can modify the manifest file/location in vite.config.js
      // vite-plugin-shopify should set build.manifest to true, which will use the default
      // value of VITE_MANIFEST. But let's err on the safe side and double check
      // that it has not been modified by the user.
      if (_config.build.manifest === true) {
        manifestFile = VITE_MANIFEST;
      } else if (typeof _config.build.manifest === 'string') {
        manifestFile = _config.build.manifest;
      }
    },

    async buildStart(): Promise<void> {
      // This hook is triggered on every change in watch mode
      // so we need to clear the asset map and rebuild it.
      assetMap.clear();
      assetDestSet.clear();

      for (const target of targets) {
        const assetFiles = await fg(normalizePath(target.src), { ignore: target.ignore });

        for (const file of assetFiles) {
          const fileName = target.rename ? await renameFile(basename(file), file, target.rename) : basename(file);
          const resolvedDest = join(target.dest, fileName);

          // Static assets are not watched in Vite/Rollup, so we
          // collect all relevant asset directories to watch.
          if (onWatch && this.meta.watchMode) {
            assetDirSet.add(resolve(themeAssetsDir, dirname(file)));
          }

          // Check if the asset is a duplicate.
          if (assetDestSet.has(resolvedDest)) {
            if (!silent) {
              const relativeDupeSrc = relative(publicDir, file);
              logWarn(`Duplicate asset found. Ignoring ${relativeDupeSrc}`, logger, true);
            }
            continue;
          }
          assetDestSet.add(resolvedDest);

          // Add the file to our asset map and asset files set.
          assetMap.set(file, { ...target, dest: resolvedDest });
          assetFilesSet.add(basename(file));
        }
      }

      // Watch the collected asset directories.
      if (onWatch && this.meta.watchMode) {
        for (const dir of assetDirSet.values()) {
          this.addWatchFile(dir);
        }
      }
    },

    async writeBundle(_, bundle): Promise<void> {
      if (!clean) return;

      if (!manifestFile) {
        logWarn('Manifest not enabled in vite config build.manifest. Skipping clean.', logger, true);
        return;
      }

      const manifestAsset = bundle[manifestFile];
      if (!manifestAsset || !('source' in manifestAsset)) {
        logWarn('Manifest file not found. Skipping clean.', logger, true);
        return;
      }

      const manifest = JSON.parse(manifestAsset.source.toString()) as Manifest;
      const filesInManifest = getFilesInManifest(manifest);
      const filesInAssetDir = await readdir(themeAssetsDir);

      const filesToDelete = filesInAssetDir
        .filter((file) => {
          // Vite will not let you delete the .vite directory,
          // even if build.manifest (manifestFile below) was modified by the user
          return !(
            file === '.vite' ||
            file === manifestFile ||
            filesInManifest.includes(file) ||
            assetFilesSet.has(file)
          );
        })
        .map((file) => join(themeAssetsDir, file));

      for (const target of assetMap.values()) {
        if (!target.cleanMatch) continue;
        const otherRemovedFiles = await fg(target.cleanMatch, { ignore: [target.dest] });
        filesToDelete.push(...otherRemovedFiles);
      }

      await Promise.all(
        filesToDelete.map(async (file) => {
          return existsSync(file) ? unlink(file).then(() => Promise.resolve(file)) : Promise.resolve(file);
        }),
      )
        .then((results) => {
          if (!results.length) return;
          for (const fileDeleted of results) {
            const relativePath = relative(themeRoot, fileDeleted);
            logEvent('delete', relativePath, logger);
          }
        })
        .catch((reason) => {
          if (!silent) logger.error(reason);
        });
    },

    async closeBundle(): Promise<void> {
      if (onBuild || (onWatch && this.meta.watchMode)) {
        copyAllAssetMap(assetMap, themeRoot, logger, { silent, timestamp: false });
      }
    },

    async watchChange(fileChanged, { event }): Promise<void> {
      // Check if the file changed is in our watched assets directory
      // If it's not, we don't care about it.
      if (!assetDirSet.has(dirname(fileChanged))) {
        return;
      }

      // Check if the file changed is in our asset map.
      const asset = assetMap.get(fileChanged);
      if (!asset) {
        return;
      }

      // If the asset is in our map, and the event is delete, we need to:
      // - remove it from the asset map.
      // - remove it from the asset files set.
      if (event === 'delete') {
        assetMap.delete(fileChanged);
        assetFilesSet.delete(basename(fileChanged));
        const relativeDeleted = relative(themeRoot, asset.dest);
        logEvent(event, relativeDeleted, logger);
      }
    },

    async closeWatcher(): Promise<void> {
      // Copy all assets on close to make sure they're up to date.
      await copyAllAssetMap(assetMap, themeRoot, logger, { silent, timestamp: false });
    },
  };
};
