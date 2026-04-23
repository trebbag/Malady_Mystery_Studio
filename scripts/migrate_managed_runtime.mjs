import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { Client } from 'pg';

import { findRepoRoot } from '../packages/shared-config/src/repo-paths.mjs';
import { AzureBlobObjectStorage } from '../services/intake-api/src/azure-object-storage.mjs';
import { PlatformStore } from '../services/intake-api/src/store.mjs';

const rootDir = findRepoRoot(import.meta.url);
const dbFilePath = process.env.PLATFORM_DB_FILE ?? path.join(rootDir, 'var', 'db', 'platform.sqlite');
const objectStoreDir = process.env.OBJECT_STORE_DIR ?? path.join(rootDir, 'var', 'object-store');
const migrationSqlPath = path.join(rootDir, 'infra', 'migrations', '0001_platform_store.sql');
const reportPath = path.join(rootDir, 'var', 'ops', `managed-migration-${new Date().toISOString().replaceAll(':', '-')}.json`);

/** @typedef {Record<string, unknown>} SqlRow */

/**
 * @param {string} name
 * @returns {string}
 */
function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required for managed migration.`);
  }

  return value;
}

/**
 * @param {string} contentType
 * @param {string} location
 * @returns {string}
 */
function inferExtension(contentType, location) {
  if (contentType.includes('json')) {
    return 'json';
  }

  if (contentType.includes('markdown')) {
    return 'md';
  }

  if (contentType.includes('png')) {
    return 'png';
  }

  if (contentType.includes('jpeg')) {
    return 'jpg';
  }

  if (contentType.includes('plain')) {
    return 'txt';
  }

  const extension = path.extname(location).replace('.', '');
  return extension || 'bin';
}

/**
 * @param {Client} client
 * @param {string} sql
 * @param {unknown[]} values
 * @returns {Promise<void>}
 */
async function upsert(client, sql, values) {
  await client.query(sql, values);
}

const localStore = new PlatformStore({
  rootDir,
  dbFilePath,
  objectStoreDir,
});
const postgres = new Client({
  connectionString: requireEnv('MANAGED_POSTGRES_URL'),
});
const blobStorage = new AzureBlobObjectStorage({
  connectionString: requireEnv('AZURE_BLOB_CONNECTION_STRING'),
  containerName: process.env.AZURE_BLOB_CONTAINER_NAME ?? 'dcp-artifacts',
  prefix: process.env.AZURE_BLOB_PREFIX ?? 'managed-migration',
});

/** @type {Record<string, number>} */
const counts = {};

try {
  await postgres.connect();
  await postgres.query(await readFile(migrationSqlPath, 'utf8'));

  /**
   * @param {string} tableName
   * @param {string[]} columns
   * @param {string[]} [conflictColumns]
   * @returns {Promise<void>}
   */
  const copyTable = async (tableName, columns, conflictColumns = columns) => {
    /** @type {SqlRow[]} */
    const rows = localStore.db.prepare(`SELECT ${columns.join(', ')} FROM ${tableName}`).all();

    for (const row of rows) {
      const values = columns.map((column) => row[column] ?? null);
      const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
      const updates = conflictColumns
        .filter((column) => column !== columns[0])
        .map((column) => `${column} = EXCLUDED.${column}`)
        .join(', ');

      await upsert(
        postgres,
        `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT (${columns[0]}) DO UPDATE SET ${updates}`,
        values,
      );
      counts[tableName] = (counts[tableName] ?? 0) + 1;
    }
  };

  await copyTable('retention_policies', ['retention_class', 'description', 'default_days']);
  await copyTable('tenants', ['id', 'slug', 'display_name', 'status', 'sso_mode', 'retention_defaults_json', 'created_at', 'updated_at']);
  await copyTable('users', ['id', 'email', 'display_name', 'status', 'auth_provider', 'subject', 'password_hash', 'created_at', 'updated_at']);
  await copyTable('projects', ['id', 'tenant_id', 'title', 'status', 'active_workflow_run_id', 'created_at', 'updated_at', 'version', 'payload_json']);
  await copyTable('workflow_runs', ['id', 'tenant_id', 'project_id', 'state', 'current_stage', 'created_at', 'updated_at', 'version', 'payload_json']);
  await copyTable('workflow_events', ['id', 'workflow_run_id', 'event_type', 'occurred_at', 'payload_json']);
  await copyTable('audit_log_entries', ['id', 'tenant_id', 'subject_type', 'subject_id', 'action', 'outcome', 'occurred_at', 'payload_json']);
  await copyTable('export_history', ['id', 'release_id', 'workflow_run_id', 'tenant_id', 'exported_by', 'exported_at', 'status', 'bundle_location', 'bundle_index_location', 'payload_json']);

  /** @type {SqlRow[]} */
  const membershipRows = localStore.db.prepare(
    'SELECT tenant_id, user_id, roles_json, created_at, updated_at FROM memberships',
  ).all();
  for (const row of membershipRows) {
    await upsert(
      postgres,
      'INSERT INTO memberships (tenant_id, user_id, roles_json, created_at, updated_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (tenant_id, user_id) DO UPDATE SET roles_json = EXCLUDED.roles_json, updated_at = EXCLUDED.updated_at',
      [row.tenant_id, row.user_id, row.roles_json, row.created_at, row.updated_at],
    );
    counts.memberships = (counts.memberships ?? 0) + 1;
  }

  /** @type {SqlRow[]} */
  const sessionRows = localStore.db.prepare(
    'SELECT id, tenant_id, user_id, token_hash, auth_method, expires_at, created_at, last_seen_at, metadata_json FROM sessions',
  ).all();
  for (const row of sessionRows) {
    await upsert(
      postgres,
      'INSERT INTO sessions (id, tenant_id, user_id, token_hash, auth_method, expires_at, created_at, last_seen_at, metadata_json) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id, user_id = EXCLUDED.user_id, token_hash = EXCLUDED.token_hash, auth_method = EXCLUDED.auth_method, expires_at = EXCLUDED.expires_at, last_seen_at = EXCLUDED.last_seen_at, metadata_json = EXCLUDED.metadata_json',
      [row.id, row.tenant_id, row.user_id, row.token_hash, row.auth_method, row.expires_at, row.created_at, row.last_seen_at, row.metadata_json],
    );
    counts.sessions = (counts.sessions ?? 0) + 1;
  }

  /** @type {SqlRow[]} */
  const artifactRows = localStore.db.prepare(
    'SELECT artifact_type, artifact_id, tenant_id, content_type, retention_class, created_at FROM artifacts ORDER BY created_at ASC',
  ).all();
  for (const row of artifactRows) {
    const artifact = localStore.getArtifact(String(row.artifact_type), String(row.artifact_id));

    if (!artifact) {
      continue;
    }

    const uploaded = await blobStorage.putObject(
      String(row.tenant_id),
      'artifacts',
      `${String(row.artifact_type)}/${String(row.artifact_id)}`,
      JSON.stringify(artifact, null, 2),
      {
        extension: 'json',
        contentType: String(row.content_type),
      },
    );

    await upsert(
      postgres,
      'INSERT INTO artifacts (artifact_type, artifact_id, tenant_id, content_type, location, checksum, retention_class, created_at, payload_json) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (artifact_type, artifact_id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id, content_type = EXCLUDED.content_type, location = EXCLUDED.location, checksum = EXCLUDED.checksum, retention_class = EXCLUDED.retention_class, payload_json = EXCLUDED.payload_json',
      [row.artifact_type ?? '', row.artifact_id ?? '', row.tenant_id ?? '', row.content_type ?? 'application/json', uploaded.location, uploaded.checksum, row.retention_class ?? 'artifact', row.created_at ?? new Date().toISOString(), JSON.stringify(artifact, null, 2)],
    );
    counts.artifacts = (counts.artifacts ?? 0) + 1;
  }

  /** @type {SqlRow[]} */
  const documentRows = localStore.db.prepare(
    'SELECT document_type, document_id, tenant_id, content_type, retention_class, created_at, location FROM documents ORDER BY created_at ASC',
  ).all();
  for (const row of documentRows) {
    const contents = localStore.getDocumentObject(String(row.document_type), String(row.document_id));

    if (!contents) {
      continue;
    }

    const uploaded = await blobStorage.putObject(
      String(row.tenant_id),
      String(row.document_type),
      String(row.document_id),
      contents,
      {
        extension: inferExtension(String(row.content_type ?? 'application/octet-stream'), String(row.location ?? '')),
        contentType: String(row.content_type ?? 'application/octet-stream'),
      },
    );

    await upsert(
      postgres,
      'INSERT INTO documents (document_type, document_id, tenant_id, content_type, location, checksum, retention_class, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (document_type, document_id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id, content_type = EXCLUDED.content_type, location = EXCLUDED.location, checksum = EXCLUDED.checksum, retention_class = EXCLUDED.retention_class',
      [row.document_type ?? '', row.document_id ?? '', row.tenant_id ?? '', row.content_type ?? 'application/octet-stream', uploaded.location, uploaded.checksum, row.retention_class ?? 'document', row.created_at ?? new Date().toISOString()],
    );
    counts.documents = (counts.documents ?? 0) + 1;
  }

  await writeFile(reportPath, JSON.stringify({
    migratedAt: new Date().toISOString(),
    counts,
    metadataStore: 'postgres',
    objectStore: 'azure-blob',
  }, null, 2));

  console.log(JSON.stringify({
    migratedAt: new Date().toISOString(),
    reportPath,
    counts,
  }, null, 2));
} finally {
  localStore.close();
  await postgres.end().catch(() => {});
}
