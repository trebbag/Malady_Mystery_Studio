import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { findRepoRoot } from '../packages/shared-config/src/repo-paths.mjs';
import { validateRepoPack } from './validate_repo_pack.mjs';

const rootDir = findRepoRoot(import.meta.url);

test('validateRepoPack passes against the starter repository', async () => {
  const result = await validateRepoPack(rootDir);

  assert.deepEqual(result.failures, []);
});

test('validateRepoPack fails when an example drifts from its schema', async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'malady-starter-pack-'));

  try {
    await cp(rootDir, tempDir, {
      recursive: true,
      filter: (source) => {
        const relativePath = path.relative(rootDir, source);

        if (!relativePath) {
          return true;
        }

        return !relativePath.startsWith(`node_modules${path.sep}`) && !relativePath.startsWith(`dist${path.sep}`);
      },
    });

    const projectExamplePath = path.join(tempDir, 'examples/sample_project.json');
    const projectExample = JSON.parse(await readFile(projectExamplePath, 'utf8'));
    delete projectExample.id;
    await writeFile(projectExamplePath, `${JSON.stringify(projectExample, null, 2)}\n`);

    const result = await validateRepoPack(tempDir);

    assert.equal(result.failures.length > 0, true);
    assert.equal(
      result.failures.some((failure) => failure.includes('sample_project.json')),
      true,
    );
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
});
