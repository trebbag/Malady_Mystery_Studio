import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { Client } from 'pg';

import { findRepoRoot } from '../packages/shared-config/src/repo-paths.mjs';
import { AzureBlobObjectStorage } from '../services/intake-api/src/azure-object-storage.mjs';

const rootDir = findRepoRoot(import.meta.url);
const outputDir = path.join(rootDir, 'var', 'ops', 'restore-smoke');
const timestamp = new Date().toISOString();
const outputPath = path.join(outputDir, `${timestamp.replaceAll(':', '-')}.json`);

/**
 * @param {string} name
 * @returns {string}
 */
function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required to run the restore smoke.`);
  }

  return value;
}

/** @type {Record<string, unknown>} */
const report = {
  startedAt: timestamp,
  metadataStore: 'postgres',
  objectStore: 'azure-blob',
  checks: [],
};

await mkdir(outputDir, { recursive: true });

const postgres = new Client({
  connectionString: requireEnv('MANAGED_POSTGRES_URL'),
});
const blobStorage = new AzureBlobObjectStorage({
  connectionString: requireEnv('AZURE_BLOB_CONNECTION_STRING'),
  containerName: process.env.AZURE_BLOB_CONTAINER_NAME ?? 'dcp-artifacts',
  prefix: process.env.AZURE_BLOB_PREFIX ?? 'restore-smoke',
});

try {
  await postgres.connect();
  await postgres.query('SELECT 1');
  /** @type {Array<Record<string, unknown>>} */ (report.checks).push({
    name: 'postgres-connectivity',
    status: 'passed',
  });

  const scratchLocation = await blobStorage.putObject(
    'tenant.local',
    'ops-drill',
    `restore-smoke-${Date.now()}`,
    JSON.stringify({ timestamp }, null, 2),
    { extension: 'json', contentType: 'application/json' },
  );
  await blobStorage.getJson(scratchLocation.location);
  /** @type {Array<Record<string, unknown>>} */ (report.checks).push({
    name: 'blob-roundtrip',
    status: 'passed',
    location: scratchLocation.location,
  });

  /** @type {Array<Record<string, unknown>>} */ (report.checks).push({
    name: 'backup-policy',
    status: 'manual-followup',
    note: 'Managed Postgres backup policy and Blob soft-delete/versioning must still be confirmed in Azure after deployment.',
  });
  report.status = 'passed';
  report.completedAt = new Date().toISOString();
} catch (error) {
  /** @type {Array<Record<string, unknown>>} */ (report.checks).push({
    name: 'restore-smoke',
    status: 'failed',
    error: error instanceof Error ? error.message : String(error),
  });
  report.status = 'failed';
  report.completedAt = new Date().toISOString();
  await writeFile(outputPath, JSON.stringify(report, null, 2));
  throw error;
} finally {
  await writeFile(outputPath, JSON.stringify(report, null, 2));
  await postgres.end().catch(() => {});
}

console.log(outputPath);

