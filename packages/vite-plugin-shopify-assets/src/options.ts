import { resolve, join } from 'node:path';
import { constants } from 'node:fs/promises';

import { normalizePath } from 'vite';
import fg from 'fast-glob';

import { VITE_PUBLIC_DIRNAME, THEME_ASSETS_DIRNAME } from './constants.js';

type MaybePromise<T> = T | Promise<T>;

export type RenameFunc = (fileName: string, fileExtension: string, fullPath: string) => MaybePromise<string>;

export type Target = {
  /**
   * Directory path or glob pattern of the source files, relative to `publicDir`.
   *
   * When a target is passed as a string, it is used as the `src` value (other values are set to defaults).
   *
   * ```js
   * targets: [
   *   { src: 'images/*.{jpg,gif,png,webp}' }, // passing `src` in Target object
   *   'fonts/*.{woff,woff2}',                 // passing `src` as a string
   * ],
   * ```
   */
  src: string;
  /**
   * Destination folder, relative to `themeRoot`.
   *
   * Most useful when combined with `target.rename` and/or `target.cleanMatch`. That makes it possible
   * to 'convert' files to `.liquid` and copy into other folders, like `snippets/`.
   *
   * **NOTE:** By default, when `dest` is not `<themeRoot>/assets`, deleted asset source files will not
   * trigger the deletion of the previously generated copy by default. To enable that, set `cleanMatch`
   * to a valid glob pattern of the expected final file.
   *
   * ```js
   * targets: [{
   *   src: 'icons/icon-*.svg',
   *   dest: 'snippets',
   *   rename: (file, ext, src) => `${file}.liquid`,
   *   cleanMatch: 'icon-*.liquid'
   * }],
   * ```
   *
   * @default '<themeRoot>/assets'
   */
  dest?: string;
  /**
   * Glob pattern to clean matching assets. **Use with caution:** back up your files prior to enabling this.
   *
   * Should only be used when the target destination is not the theme assets folder, and
   * when you are _completely sure that all files matching the pattern can be safely deleted._
   *
   * **NOTE:** It will have no effect when `dest` is not set or it is equal to the default value
   * (ie: `'<themeRoot>/assets'`), or when the pattern is too generic (ie: `'*'`). This is to
   * prevent accidentally deleting the wrong files.
   *
   * ```js
   * targets: [{
   *   src: 'icons/icon-*.svg',
   *   dest: 'snippets',
   *   rename: (file, ext, src) => `${file}.liquid`,
   *   cleanMatch: 'icon-*.liquid'
   * }],
   * ```
   *
   * @default undefined
   */
  cleanMatch?: string;
  /**
   * Glob patterns to ignore, relative to `publicDir` (the root of all asset source files
   * in our plugin). Can be passed as an array of globs or a single glob string.
   *
   * @default []
   */
  ignore?: string | string[];
  /**
   * Rename function applied to matching files.
   *
   * ```ts
   * rename: (file: string, ext: string, src:string): string,
   * ```
   *
   * ```js
   * targets: [{
   *   src: 'icons/icon-*.svg',
   *   dest: 'snippets',
   *   rename: (file, ext, src) => `${file}.liquid`,
   * }],
   * ```
   *
   * @default undefined
   */
  rename?: string | RenameFunc;
  /**
   * Whether to dereference symlinks.
   *
   * When `true`, symlinks will be dereferenced.   *
   * @default true
   */
  dereference?: boolean;
  /**
   * Whether to overwrite the existing file.
   *
   * When `true`, it will overwrite the existing file.
   * When `false`, it will skip those files.
   * When `'error'`, it will throw an error.   *
   * @default true
   */
  force?: boolean | 'error';
  /**
   * Whether timestamps on copied files should be preserved.
   *
   * When `false`, timestamp behavior is OS-dependent.   *
   * @default true
   */
  preserveTimestamps?: boolean;
};

export type ResolvedTarget = {
  src: string;
  dest: string;
  cleanMatch?: string;
  ignore: string[];
  rename?: string | RenameFunc;
  dereference: boolean;
  errorOnExist: boolean;
  force: boolean;
  mode: number;
  preserveTimestamps: boolean;
};

export type PluginShopifyAssetsOptions = {
  /**
   * Shopify theme directory.
   *
   * @default process.cwd()
   */
  themeRoot?: string;
  /**
   * The root directory where your asset source files are located.
   *
   * This directory will always override vite's `config.publicDir`. If not set, it will default
   * to vite's `config.publicDir`. Note that by default, vite sets `config.publicDir` to root
   * on serve - that option will be overwritten by the plugin on both modes.
   *
   * @default <themeRoot>/public
   */
  publicDir?: string;
  /**
   * Array of targets to watch.
   * It can be a string representing the source path or a Target object.
   */
  targets: Array<string | Target>;
  /**
   * Watch files on serve.
   * @default true
   */
  onServe?: boolean;
  /**
   * Copy files on build.
   * @default true
   */
  onBuild?: boolean;
  /**
   * Watch files on watch mode.
   * @default true
   */
  onWatch?: boolean;
  /**
   * Suppress console output.
   * @default true
   */
  silent?: boolean;
};

export type ResolvedPluginShopifyAssetsOptions = {
  publicDir: string;
  themeRoot: string;
  themeAssetsDir: string;
  targets: ResolvedTarget[];
  onServe: boolean;
  onBuild: boolean;
  onWatch: boolean;
  silent: boolean;
};

export const resolveOptions = (options: PluginShopifyAssetsOptions): ResolvedPluginShopifyAssetsOptions => {
  // Note that for glob patterns we need to use Vite's normalizePath
  // It will convert Windows paths to POSIX for path comparation
  // Vite: https://vitejs.dev/guide/api-plugin#path-normalization
  // TODO: Test the assumption above on windows

  const publicDir = options?.publicDir ? resolve(options.publicDir) : resolve(process.cwd(), VITE_PUBLIC_DIRNAME);
  const themeRoot = options?.themeRoot ? resolve(options.themeRoot) : resolve(process.cwd());
  const themeAssetsDir = join(themeRoot, THEME_ASSETS_DIRNAME);

  const targets = options?.targets?.length
    ? options.targets.map((target: Target | string): ResolvedTarget => {
        if (typeof target === 'string') {
          return {
            src: join(publicDir, target),
            dest: resolve(themeRoot, themeAssetsDir),
            cleanMatch: undefined,
            ignore: [],
            rename: undefined,
            dereference: true,
            errorOnExist: false,
            force: true,
            mode: 0,
            preserveTimestamps: true,
          };
        }

        if (target.dest && fg.isDynamicPattern(target.dest)) {
          throw new Error('[shopify-assets] Dynamic patterns are not supported in target.dest');
        }

        return {
          src: join(publicDir, target.src),
          dest: target.dest ? join(themeRoot, target.dest) : themeAssetsDir,
          cleanMatch: resolveCleanMatch(themeRoot, target, options.silent),
          ignore: Array.isArray(target?.ignore)
            ? target.ignore.map((_ignore) => normalizePath(join(publicDir, _ignore)))
            : typeof target.ignore === 'string'
              ? [normalizePath(join(publicDir, target.ignore))]
              : [],
          rename: target.rename,
          dereference: target.dereference ?? true,
          errorOnExist: target.force === 'error',
          force: target.force === 'error' ? false : true,
          mode: target.force === 'error' ? constants.COPYFILE_EXCL : 0,
          preserveTimestamps: target.preserveTimestamps ?? true,
        };
      })
    : [];

  return {
    publicDir,
    themeAssetsDir,
    themeRoot,
    targets,
    onServe: options?.onServe ?? true,
    onBuild: options?.onBuild ?? true,
    onWatch: options?.onWatch ?? true,
    silent: options?.silent ?? true,
  };
};

/**
 *
 * @param [string] themeRoot - Theme root directory, as defined in plugin options.
 * @param {Target} target - Target object, as defined in plugin options.
 * @param {boolean} [silent] - Whether to suppress console output.
 * @returns `undefined` if `target.cleanMatch` is not set or is invalid, otherwise returns the resolved glob pattern.
 */
function resolveCleanMatch(themeRoot: string, target: Target, silent: boolean = true): string | undefined {
  if (!target.cleanMatch) {
    return undefined;
  }

  if (!target.dest || target.dest === THEME_ASSETS_DIRNAME) {
    if (!silent) {
      console.warn(
        '[shopify-assets] WARNING: target.cleanMatch will have no effect when target.dest is not set or is equal to the default value.',
      );
    }
    return undefined;
  }

  if (
    target.cleanMatch &&
    (target.cleanMatch === '**/*' ||
      target.cleanMatch === '**/*.*' ||
      target.cleanMatch === '**' ||
      target.cleanMatch === '*' ||
      target.cleanMatch === '*.*')
  ) {
    if (!silent) {
      console.warn(
        '[shopify-assets] WARNING: target.cleanMatch pattern is too generic and will be disabled to prevent accidentally deleting files.',
      );
    }
    return undefined;
  }

  return normalizePath(join(themeRoot, target.dest, target.cleanMatch));
}
