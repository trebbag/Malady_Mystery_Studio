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
 * @param {string} rootDir
 * @param {string | undefined} value
 * @param {string} fallback
 * @returns {string}
 */
function resolveConfiguredPath(rootDir, value, fallback) {
  if (!value || !value.trim()) {
    return fallback;
  }

  return path.isAbsolute(value) ? value : path.join(rootDir, value);
}

/**
 * @param {{ rootDir?: string }} [options]
 * @returns {{ rootDir: string, dbDir: string, dbFilePath: string, objectStoreDir: string, backupRootDir: string }}
 */
export function getLocalStoragePaths(options = {}) {
  const rootDir = options.rootDir ?? findRepoRoot(import.meta.url);
  const dbFilePath = resolveConfiguredPath(rootDir, process.env.PLATFORM_DB_FILE, path.join(rootDir, 'var', 'db', 'platform.sqlite'));
  const objectStoreDir = resolveConfiguredPath(rootDir, process.env.OBJECT_STORE_DIR, path.join(rootDir, 'var', 'object-store'));
  const backupRootDir = resolveConfiguredPath(rootDir, process.env.LOCAL_BACKUP_DIR, path.join(rootDir, 'var', 'backups'));

  return {
    rootDir,
    dbDir: path.dirname(dbFilePath),
    dbFilePath,
    objectStoreDir,
    backupRootDir,
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
      for (const entry of entries) {
        await cp(path.join(paths.objectStoreDir, entry), path.join(objectStoreBackupDir, entry), { recursive: true });
      }
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
    for (const entry of await readdir(sourceObjectStoreDir)) {
      await cp(path.join(sourceObjectStoreDir, entry), path.join(paths.objectStoreDir, entry), { recursive: true });
    }
  }
}
