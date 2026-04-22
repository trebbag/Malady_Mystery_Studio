import { access, cp, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';

import { findRepoRoot } from '../packages/shared-config/src/repo-paths.mjs';

/**
 * @param {string} targetPath
 * @returns {Promise<boolean>}
 */
async function exists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} value
 * @returns {string}
 */
function toTimestampSlug(value) {
  return value.replaceAll(':', '-').replaceAll('.', '-');
}

/**
 * @param {{ rootDir?: string }} [options]
 * @returns {{ rootDir: string, dbDir: string, dbFilePath: string, objectStoreDir: string, backupRootDir: string }}
 */
export function getLocalStoragePaths(options = {}) {
  const rootDir = options.rootDir ?? findRepoRoot(import.meta.url);

  return {
    rootDir,
    dbDir: path.join(rootDir, 'var', 'db'),
    dbFilePath: path.join(rootDir, 'var', 'db', 'platform.sqlite'),
    objectStoreDir: path.join(rootDir, 'var', 'object-store'),
    backupRootDir: path.join(rootDir, 'var', 'backups'),
  };
}

/**
 * @param {{ rootDir?: string }} [options]
 * @returns {Promise<void>}
 */
export async function resetLocalStorage(options = {}) {
  const paths = getLocalStoragePaths(options);

  await rm(paths.dbFilePath, { force: true });
  await rm(`${paths.dbFilePath}-shm`, { force: true });
  await rm(`${paths.dbFilePath}-wal`, { force: true });
  await rm(paths.objectStoreDir, { force: true, recursive: true });
  await mkdir(paths.dbDir, { recursive: true });
  await mkdir(paths.objectStoreDir, { recursive: true });
}

/**
 * @param {{ rootDir?: string }} [options]
 * @returns {Promise<string>}
 */
export async function backupLocalStorage(options = {}) {
  const paths = getLocalStoragePaths(options);
  const backupDir = path.join(paths.backupRootDir, toTimestampSlug(new Date().toISOString()));
  const dbBackupDir = path.join(backupDir, 'db');
  const objectStoreBackupDir = path.join(backupDir, 'object-store');

  await mkdir(dbBackupDir, { recursive: true });
  await mkdir(objectStoreBackupDir, { recursive: true });

  for (const sourcePath of [paths.dbFilePath, `${paths.dbFilePath}-shm`, `${paths.dbFilePath}-wal`]) {
    if (await exists(sourcePath)) {
      await cp(sourcePath, path.join(dbBackupDir, path.basename(sourcePath)));
    }
  }

  if (await exists(paths.objectStoreDir)) {
    const entries = await readdir(paths.objectStoreDir);

    if (entries.length > 0) {
      await cp(paths.objectStoreDir, objectStoreBackupDir, { recursive: true });
    }
  }

  return backupDir;
}

/**
 * @param {{ rootDir?: string, backupDir: string }} options
 * @returns {Promise<void>}
 */
export async function restoreLocalStorage(options) {
  const paths = getLocalStoragePaths(options);
  const sourceDbDir = path.join(options.backupDir, 'db');
  const sourceObjectStoreDir = path.join(options.backupDir, 'object-store');

  await resetLocalStorage(paths);

  if (await exists(sourceDbDir)) {
    for (const fileName of await readdir(sourceDbDir)) {
      await cp(path.join(sourceDbDir, fileName), path.join(paths.dbDir, fileName));
    }
  }

  if (await exists(sourceObjectStoreDir)) {
    await cp(sourceObjectStoreDir, paths.objectStoreDir, { recursive: true });
  }
}
