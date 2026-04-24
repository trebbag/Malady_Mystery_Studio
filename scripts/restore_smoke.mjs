import { access, cp, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { loadDotEnv } from '../packages/shared-config/src/env.mjs';
import { findRepoRoot } from '../packages/shared-config/src/repo-paths.mjs';
import { backupLocalStorage, getLocalStoragePaths } from './local_storage_tools.mjs';

loadDotEnv({ moduleUrl: import.meta.url });

const rootDir = findRepoRoot(import.meta.url);
const timestamp = new Date().toISOString();
const timestampSlug = timestamp.replaceAll(':', '-').replaceAll('.', '-');
const outputDir = path.join(rootDir, 'var', 'ops', 'restore-smoke');
const outputPath = path.join(outputDir, `${timestampSlug}.json`);
const dryRun = process.argv.includes('--dry-run') || process.env.RESTORE_SMOKE_DRY_RUN === '1';

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
 * @param {string} directoryPath
 * @returns {Promise<{ objectCount: number, byteLength: number }>}
 */
async function directoryStats(directoryPath) {
  if (!(await exists(directoryPath))) {
    return {
      objectCount: 0,
      byteLength: 0,
    };
  }

  let objectCount = 0;
  let byteLength = 0;
  const entries = await readdir(directoryPath, {
    withFileTypes: true,
  });

  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      const childStats = await directoryStats(entryPath);
      objectCount += childStats.objectCount;
      byteLength += childStats.byteLength;
      continue;
    }

    if (entry.isFile()) {
      const fileStats = await stat(entryPath);
      objectCount += 1;
      byteLength += fileStats.size;
    }
  }

  return {
    objectCount,
    byteLength,
  };
}

await mkdir(outputDir, { recursive: true });

const paths = getLocalStoragePaths({ rootDir });
const scratchDir = path.join(outputDir, `scratch-${timestampSlug}`);
/** @type {Record<string, unknown>} */
const report = {
  startedAt: timestamp,
  mode: dryRun ? 'local-filesystem-dry-run' : 'local-filesystem',
  metadataStore: 'sqlite',
  objectStore: 'filesystem',
  dbFilePath: paths.dbFilePath,
  objectStoreDir: paths.objectStoreDir,
  scratchDir,
  checks: [],
};

if (dryRun) {
  report.status = 'ready-locally';
  report.backupDir = path.join(paths.backupRootDir, `<timestamp>`);
  /** @type {Array<Record<string, unknown>>} */ (report.checks).push(
    {
      name: 'sqlite-path',
      status: await exists(paths.dbFilePath) ? 'ready-locally' : 'not-created-yet',
      path: paths.dbFilePath,
    },
    {
      name: 'object-store-path',
      status: await exists(paths.objectStoreDir) ? 'ready-locally' : 'not-created-yet',
      path: paths.objectStoreDir,
    },
    {
      name: 'scratch-restore',
      status: 'planned',
      path: scratchDir,
    },
  );
  report.completedAt = new Date().toISOString();
  await writeFile(outputPath, JSON.stringify(report, null, 2));
  console.log(outputPath);
  process.exit(0);
}

await rm(scratchDir, { recursive: true, force: true });
await mkdir(scratchDir, { recursive: true });

const backupDir = await backupLocalStorage({ rootDir });
report.backupDir = backupDir;
/** @type {Array<Record<string, unknown>>} */ (report.checks).push({
  name: 'local-backup',
  status: 'passed',
  path: backupDir,
});

await cp(backupDir, scratchDir, { recursive: true });
/** @type {Array<Record<string, unknown>>} */ (report.checks).push({
  name: 'scratch-copy',
  status: 'passed',
  path: scratchDir,
});

const restoredDbPath = path.join(scratchDir, 'db', path.basename(paths.dbFilePath));
const restoredDbPresent = await exists(restoredDbPath);
/** @type {Array<Record<string, unknown>>} */ (report.checks).push({
  name: 'restored-sqlite-present',
  status: restoredDbPresent ? 'passed' : 'failed',
  path: restoredDbPath,
});

const restoredObjectStats = await directoryStats(path.join(scratchDir, 'object-store'));
report.stats = {
  dbFileCopied: restoredDbPresent,
  objectCount: restoredObjectStats.objectCount,
  byteLength: restoredObjectStats.byteLength,
};
report.status = restoredDbPresent ? 'passed' : 'failed';
report.completedAt = new Date().toISOString();

await writeFile(outputPath, JSON.stringify(report, null, 2));
console.log(outputPath);

if (!restoredDbPresent) {
  process.exitCode = 1;
}
