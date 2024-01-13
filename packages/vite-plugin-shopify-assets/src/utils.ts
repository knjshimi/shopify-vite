import { basename, dirname, relative, resolve, sep, parse } from 'node:path';
import { cp, unlink } from 'node:fs/promises';
import pc from 'picocolors';
import fg from 'fast-glob';
import { normalizePath } from 'vite';

import type { Logger, Manifest } from 'vite';
import type { AssetMap } from './build.js';
import type { ResolvedTarget, RenameFunc } from './options.js';

const logMessage = (
  message: string,
  logger: Logger,
  level: 'success' | 'warn' | 'error' | 'info' | undefined,
  timestamp: boolean = false,
) => {
  const color =
    level === 'success'
      ? pc.green
      : level === 'warn'
        ? pc.yellow
        : level === 'error'
          ? pc.red
          : level === 'info'
            ? pc.cyan
            : pc.dim;

  logger.info(pc.dim('[shopify-assets] ') + color(message), { timestamp });
};

const logMessageConsole = (message: string, level: 'success' | 'warn' | 'error' | 'info' | undefined) => {
  const color =
    level === 'success'
      ? pc.green
      : level === 'warn'
        ? pc.yellow
        : level === 'error'
          ? pc.red
          : level === 'info'
            ? pc.cyan
            : pc.dim;

  console.log(pc.dim('[shopify-assets] ') + color(message));
};

export const logSuccess = (message: string, logger: Logger, timestamp: boolean = false) =>
  logMessage(message, logger, 'success', timestamp);
export const logWarn = (message: string, logger: Logger, timestamp: boolean = false) =>
  logMessage(message, logger, 'warn', timestamp);
export const logError = (message: string, logger: Logger, timestamp: boolean = false) =>
  logMessage(message, logger, 'error', timestamp);
export const logInfo = (message: string, logger: Logger, timestamp: boolean = false) =>
  logMessage(message, logger, 'info', timestamp);

export const logWarnConsole = (message: string) => logMessageConsole(message, 'warn');

export const logCopySuccess = (dest: string, src: string, themeRoot: string, logger: Logger, timestamp = false) => {
  logger.info(
    pc.dim(`[shopify-assets] ${relative(themeRoot, dirname(dest))}${sep}`) +
      pc.green(basename(dest)) +
      pc.dim(` from ${relative(themeRoot, dirname(src))}`),
    { timestamp },
  );
};

export const logCopyError = (dest: string, src: string, themeRoot: string, logger: Logger, timestamp = false) => {
  logger.info(
    pc.dim(`[shopify-assets] could not copy ${relative(themeRoot, dirname(dest))}${sep}`) +
      pc.red(basename(dest)) +
      pc.dim(` from ${relative(themeRoot, dirname(src))}`),
    { timestamp },
  );
};

export const logEvent = (type: 'create' | 'update' | 'delete', path: string, logger: Logger) => {
  const color = type === 'delete' ? pc.red : type === 'create' ? pc.green : type === 'update' ? pc.cyan : pc.dim;

  logger.info(
    pc.dim(`[shopify-assets] ${dirname(path)}${path.includes(sep) ? sep : ''}`) +
      color(basename(path)) +
      pc.dim(` ${type}d`),
    { timestamp: true },
  );
};

export const logEventIgnored = (type: 'create' | 'update' | 'delete', path: string, logger: Logger) => {
  logger.info(
    pc.dim(`[shopify-assets] ${dirname(path)}${path.includes(sep) ? sep : ''}`) +
      pc.yellow(basename(path)) +
      pc.dim(` ${type} ignored`),
    { timestamp: true },
  );
};

export const renameFile = async (file: string, src: string, rename: string | RenameFunc): Promise<string> => {
  if (typeof rename === 'string') {
    return rename;
  }

  const { name, ext } = parse(file);
  return rename(name, ext.replace('.', ''), src);
};

export const copyAsset = async (
  themeRoot: string,
  target: ResolvedTarget,
  fileChanged: string,
  event: 'create' | 'update',
  logger: Logger,
  silent: boolean = true,
): Promise<void> => {
  const { base: file } = parse(fileChanged);
  const destPath = target.rename
    ? resolve(target.dest, await renameFile(file, file, target.rename))
    : resolve(target.dest, file);

  const relativePath = relative(themeRoot, destPath);

  cp(fileChanged, destPath, {
    dereference: target.dereference,
    errorOnExist: target.errorOnExist,
    force: target.force,
    mode: target.mode,
    preserveTimestamps: target.preserveTimestamps,
  })
    .then(() => logEvent(event, relativePath, logger))
    .catch((reason) => {
      logError(`could not create ${relativePath}`, logger);
      if (!silent) logger.error(reason);
    });
};

export const deleteAsset = async (
  themeRoot: string,
  target: ResolvedTarget,
  fileChanged: string,
  event: 'delete',
  logger: Logger,
  silent: boolean = true,
): Promise<void> => {
  const { base: file } = parse(fileChanged);

  const destPath = target.rename
    ? resolve(target.dest, await renameFile(file, file, target.rename))
    : resolve(target.dest, file);

  const relativePath = relative(themeRoot, destPath);

  unlink(destPath)
    .then(() => logEvent(event, relativePath, logger))
    .catch((reason) => {
      logError(`could not delete ${relativePath}`, logger);
      if (!silent) logger.error(reason);
    });
};

export const copyAllAssets = async (
  target: ResolvedTarget,
  themeRoot: string,
  logger: Logger,
  options: { silent?: boolean; timestamp?: boolean } = { silent: true, timestamp: false },
): Promise<void> => {
  const assetFiles = await fg(normalizePath(target.src), { ignore: target.ignore });
  if (!assetFiles.length) return;

  for (const src of assetFiles) {
    const { base: file } = parse(src);
    const dest = target.rename
      ? resolve(target.dest, await renameFile(file, src, target.rename))
      : resolve(target.dest, file);

    cp(src, dest, {
      dereference: target.dereference,
      errorOnExist: target.errorOnExist,
      force: target.force,
      mode: target.mode,
      preserveTimestamps: target.preserveTimestamps,
    })
      .then(() => logCopySuccess(dest, src, themeRoot, logger, options.timestamp))
      .catch((error) => {
        logCopyError(dest, src, themeRoot, logger, options.timestamp);
        if (!options.silent) logger.error(error);
      });
  }
};

export const copyAllAssetMap = async (
  assetMap: AssetMap,
  themeRoot: string,
  logger: Logger,
  options: { silent?: boolean; timestamp?: boolean } = { silent: true, timestamp: false },
): Promise<void> => {
  if (!assetMap?.size) return;

  for (const [src, target] of assetMap.entries()) {
    cp(src, target.dest, {
      dereference: target.dereference,
      errorOnExist: target.errorOnExist,
      force: target.force,
      mode: target.mode,
      preserveTimestamps: target.preserveTimestamps,
    })
      .then(() => logCopySuccess(target.dest, src, themeRoot, logger, options.timestamp))
      .catch((error) => {
        logCopyError(target.dest, src, themeRoot, logger, options.timestamp);
        if (!options.silent) logger.error(error);
      });
  }
};

export const getFilesInManifest = (manifest: Manifest) => {
  const filesListedInImports = new Set(
    Object.values(manifest)
      .map((block) => {
        if ('imports' in block) {
          return block.imports;
        }

        return [];
      })
      .flat(),
  );

  return Object.entries(manifest)
    .map(([key, block]) => {
      const file = block.file;
      const validFiles: string[] = [];

      // We're experiencing a manifest which is listing a file that isn't output so we'll check the imports to make sure all files are actually used. This typically only seems to be for imports which start with an _
      if (key.startsWith('_') && filesListedInImports.has(key)) {
        validFiles.push(file);
      }

      // Make sure we don't skip css files
      if ('css' in block) {
        validFiles.push(...(block.css as string[]));
      }

      validFiles.push(file);
      return validFiles;
    })
    .flat();
};
