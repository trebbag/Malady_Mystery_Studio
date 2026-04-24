import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * @returns {Promise<{ directory: string, env: NodeJS.ProcessEnv, cleanup: () => Promise<void> }>}
 */
async function createSandbox() {
  const directory = await mkdtemp(path.join(tmpdir(), 'mms-managed-dry-run-'));

  return {
    directory,
    env: {
      ...process.env,
      PLATFORM_DB_FILE: path.join(directory, 'platform.sqlite'),
      OBJECT_STORE_DIR: path.join(directory, 'object-store'),
    },
    cleanup: async () => {
      await rm(directory, { recursive: true, force: true });
    },
  };
}

test('managed migration dry run validates local data without managed credentials', async () => {
  const sandbox = await createSandbox();

  try {
    const { stdout } = await execFileAsync(process.execPath, ['scripts/migrate_managed_runtime.mjs', '--dry-run'], {
      cwd: repoRoot,
      env: {
        ...sandbox.env,
        MANAGED_POSTGRES_URL: '',
        AZURE_BLOB_CONNECTION_STRING: '',
      },
    });
    const report = JSON.parse(stdout);

    assert.equal(report.status, 'ready-locally');
    assert.equal(report.credentialStatus, 'blocked-awaiting-credentials');
    assert.equal(typeof report.tableCounts.workflow_runs, 'number');
  } finally {
    await sandbox.cleanup();
  }
});

test('restore smoke dry run reports local filesystem readiness without managed credentials', async () => {
  const sandbox = await createSandbox();

  try {
    const { stdout } = await execFileAsync(process.execPath, ['scripts/restore_smoke.mjs', '--dry-run'], {
      cwd: repoRoot,
      env: {
        ...sandbox.env,
        MANAGED_POSTGRES_URL: '',
        AZURE_BLOB_CONNECTION_STRING: '',
      },
    });

    const outputPath = stdout.trim();
    const report = JSON.parse(await readFile(outputPath, 'utf8'));

    assert.match(outputPath, /restore-smoke/u);
    assert.equal(report.status, 'ready-locally');
    assert.equal(report.metadataStore, 'sqlite');
    assert.equal(report.objectStore, 'filesystem');
  } finally {
    await sandbox.cleanup();
  }
});
