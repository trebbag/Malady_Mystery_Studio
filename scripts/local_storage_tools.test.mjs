import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  backupLocalStorage,
  getLocalStoragePaths,
  resetLocalStorage,
  restoreLocalStorage,
} from './local_storage_tools.mjs';

test('local backup, reset, and restore preserve SQLite and object storage contents', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'mms-local-storage-'));
  const paths = getLocalStoragePaths({ rootDir });

  try {
    await mkdir(paths.dbDir, { recursive: true });
    await mkdir(path.join(paths.objectStoreDir, 'tenant.local', 'qa-report'), { recursive: true });
    await writeFile(paths.dbFilePath, 'sqlite-placeholder', 'utf8');
    await writeFile(`${paths.dbFilePath}-wal`, 'wal-placeholder', 'utf8');
    await writeFile(path.join(paths.objectStoreDir, 'tenant.local', 'qa-report', 'qar.demo.001.json'), '{"ok":true}', 'utf8');

    const backupDir = await backupLocalStorage({ rootDir });

    await resetLocalStorage({ rootDir });
    await assert.rejects(() => readFile(paths.dbFilePath, 'utf8'));
    await assert.rejects(() => readFile(path.join(paths.objectStoreDir, 'tenant.local', 'qa-report', 'qar.demo.001.json'), 'utf8'));

    await restoreLocalStorage({
      rootDir,
      backupDir,
    });

    assert.equal(await readFile(paths.dbFilePath, 'utf8'), 'sqlite-placeholder');
    assert.equal(await readFile(`${paths.dbFilePath}-wal`, 'utf8'), 'wal-placeholder');
    assert.equal(await readFile(path.join(paths.objectStoreDir, 'tenant.local', 'qa-report', 'qar.demo.001.json'), 'utf8'), '{"ok":true}');
  } finally {
    await rm(rootDir, { force: true, recursive: true });
  }
});
