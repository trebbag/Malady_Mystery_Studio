import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

import { findRepoRoot } from '../packages/shared-config/src/repo-paths.mjs';

const rootDir = findRepoRoot(import.meta.url);
const distDir = path.join(rootDir, 'dist');

const copyTargets = [
  'api',
  'contracts',
  'evals',
  'infra',
  'services/clinical-retrieval',
  'services/exporter',
  'services/intake-api',
  'services/orchestrator',
  'services/story-engine',
  'packages/shared-config',
];

/**
 * @param {string} source
 * @returns {boolean}
 */
const filterBuildFile = (source) => {
  const relativePath = path.relative(rootDir, source);

  if (!relativePath) {
    return true;
  }

  if (relativePath.startsWith(`dist${path.sep}`) || relativePath.startsWith(`node_modules${path.sep}`)) {
    return false;
  }

  return !relativePath.endsWith('.test.mjs');
};

await rm(distDir, { force: true, recursive: true });
await mkdir(distDir, { recursive: true });

for (const target of copyTargets) {
  await cp(path.join(rootDir, target), path.join(distDir, target), {
    filter: filterBuildFile,
    recursive: true,
  });
}

console.log(`Built starter workspace into ${distDir}`);
