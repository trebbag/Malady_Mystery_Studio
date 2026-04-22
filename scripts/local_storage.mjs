import path from 'node:path';

import { findRepoRoot } from '../packages/shared-config/src/repo-paths.mjs';
import {
  backupLocalStorage,
  resetLocalStorage,
  restoreLocalStorage,
} from './local_storage_tools.mjs';

const rootDir = findRepoRoot(import.meta.url);
const command = process.argv[2];

if (command === 'reset') {
  await resetLocalStorage({ rootDir });
  console.log('Reset local SQLite and object storage.');
  process.exit(0);
}

if (command === 'backup') {
  const backupDir = await backupLocalStorage({ rootDir });
  console.log(backupDir);
  process.exit(0);
}

if (command === 'restore') {
  const pathIndex = process.argv.indexOf('--path');
  const backupDir = pathIndex >= 0 ? process.argv[pathIndex + 1] : null;

  if (!backupDir) {
    console.error('Usage: node scripts/local_storage.mjs restore --path <backupDir>');
    process.exit(1);
  }

  await restoreLocalStorage({
    rootDir,
    backupDir: path.resolve(rootDir, backupDir),
  });
  console.log(`Restored local SQLite and object storage from ${path.resolve(rootDir, backupDir)}.`);
  process.exit(0);
}

console.error('Usage: node scripts/local_storage.mjs <reset|backup|restore --path <backupDir>>');
process.exit(1);
