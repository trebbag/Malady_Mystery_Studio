import { readdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

import { findRepoRoot } from '../packages/shared-config/src/repo-paths.mjs';

const execFileAsync = promisify(execFile);
const rootDir = findRepoRoot(import.meta.url);
const lintRoots = [
  'scripts',
  'packages',
  'services',
];

/**
 * @param {string} directoryPath
 * @returns {Promise<string[]>}
 */
async function listModules(directoryPath) {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const discoveredFiles = [];

  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);

    if (entry.name === 'dist' || entry.name === 'node_modules') {
      continue;
    }

    if (entry.isDirectory()) {
      discoveredFiles.push(...await listModules(entryPath));
      continue;
    }

    if (entryPath.endsWith('.mjs')) {
      discoveredFiles.push(entryPath);
    }
  }

  return discoveredFiles;
}

const filesToCheck = (
  await Promise.all(
    lintRoots.map((directory) => listModules(path.join(rootDir, directory))),
  )
).flat().sort();

for (const filePath of filesToCheck) {
  await execFileAsync(process.execPath, ['--check', filePath], { cwd: rootDir });
}

console.log(`Linted ${filesToCheck.length} JavaScript modules.`);
