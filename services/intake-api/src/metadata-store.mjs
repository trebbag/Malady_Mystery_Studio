import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import * as pg from 'pg';

import { PlatformStore } from './store.mjs';

const Pool = /** @type {any} */ (pg).Pool;

/**
 * @typedef {{
 *   name: string,
 *   columns: string[],
 *   conflictTarget: string,
 *   updateColumns: string[],
 * }} TableSpec
 */

const POSTGRES_TABLE_SPECS = Object.freeze([
  {
    name: 'retention_policies',
    columns: ['retention_class', 'description', 'default_days'],
    conflictTarget: '(retention_class)',
    updateColumns: ['description', 'default_days'],
  },
  {
    name: 'tenants',
    columns: ['id', 'slug', 'display_name', 'status', 'sso_mode', 'retention_defaults_json', 'created_at', 'updated_at'],
    conflictTarget: '(id)',
    updateColumns: ['slug', 'display_name', 'status', 'sso_mode', 'retention_defaults_json', 'updated_at'],
  },
  {
    name: 'users',
    columns: ['id', 'email', 'display_name', 'status', 'auth_provider', 'subject', 'password_hash', 'created_at', 'updated_at'],
    conflictTarget: '(id)',
    updateColumns: ['email', 'display_name', 'status', 'auth_provider', 'subject', 'password_hash', 'updated_at'],
  },
  {
    name: 'memberships',
    columns: ['tenant_id', 'user_id', 'roles_json', 'created_at', 'updated_at'],
    conflictTarget: '(tenant_id, user_id)',
    updateColumns: ['roles_json', 'updated_at'],
  },
  {
    name: 'sessions',
    columns: ['id', 'tenant_id', 'user_id', 'token_hash', 'auth_method', 'expires_at', 'created_at', 'last_seen_at', 'metadata_json'],
    conflictTarget: '(id)',
    updateColumns: ['tenant_id', 'user_id', 'token_hash', 'auth_method', 'expires_at', 'last_seen_at', 'metadata_json'],
  },
  {
    name: 'projects',
    columns: ['id', 'tenant_id', 'title', 'status', 'active_workflow_run_id', 'created_at', 'updated_at', 'version', 'payload_json'],
    conflictTarget: '(id)',
    updateColumns: ['tenant_id', 'title', 'status', 'active_workflow_run_id', 'updated_at', 'version', 'payload_json'],
  },
  {
    name: 'workflow_runs',
    columns: ['id', 'tenant_id', 'project_id', 'state', 'current_stage', 'created_at', 'updated_at', 'version', 'payload_json'],
    conflictTarget: '(id)',
    updateColumns: ['tenant_id', 'project_id', 'state', 'current_stage', 'updated_at', 'version', 'payload_json'],
  },
  {
    name: 'workflow_events',
    columns: ['id', 'workflow_run_id', 'event_type', 'occurred_at', 'payload_json'],
    conflictTarget: '(id)',
    updateColumns: ['workflow_run_id', 'event_type', 'occurred_at', 'payload_json'],
  },
  {
    name: 'artifacts',
    columns: ['artifact_type', 'artifact_id', 'tenant_id', 'content_type', 'location', 'checksum', 'retention_class', 'created_at', 'payload_json'],
    conflictTarget: '(artifact_type, artifact_id)',
    updateColumns: ['tenant_id', 'content_type', 'location', 'checksum', 'retention_class', 'created_at', 'payload_json'],
  },
  {
    name: 'documents',
    columns: ['document_type', 'document_id', 'tenant_id', 'content_type', 'location', 'checksum', 'retention_class', 'created_at'],
    conflictTarget: '(document_type, document_id)',
    updateColumns: ['tenant_id', 'content_type', 'location', 'checksum', 'retention_class', 'created_at'],
  },
  {
    name: 'audit_log_entries',
    columns: ['id', 'tenant_id', 'subject_type', 'subject_id', 'action', 'outcome', 'occurred_at', 'payload_json'],
    conflictTarget: '(id)',
    updateColumns: ['tenant_id', 'subject_type', 'subject_id', 'action', 'outcome', 'occurred_at', 'payload_json'],
  },
  {
    name: 'export_history',
    columns: ['id', 'release_id', 'workflow_run_id', 'tenant_id', 'exported_by', 'exported_at', 'status', 'bundle_location', 'bundle_index_location', 'payload_json'],
    conflictTarget: '(id)',
    updateColumns: ['release_id', 'workflow_run_id', 'tenant_id', 'exported_by', 'exported_at', 'status', 'bundle_location', 'bundle_index_location', 'payload_json'],
  },
]);

const SQLITE_CLEAR_ORDER = Object.freeze([
  'sessions',
  'memberships',
  'users',
  'tenants',
  'workflow_events',
  'audit_log_entries',
  'export_history',
  'documents',
  'artifacts',
  'workflow_runs',
  'projects',
  'retention_policies',
]);

/**
 * @param {string} value
 * @returns {string}
 */
function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

/**
 * @param {string[]} columns
 * @returns {string}
 */
function joinIdentifiers(columns) {
  return columns.map((column) => quoteIdentifier(column)).join(', ');
}

/**
 * @param {{ name: string, columns: string[], conflictTarget: string, updateColumns: string[] }} spec
 * @returns {string}
 */
function createPostgresUpsertSql(spec) {
  const placeholders = spec.columns.map((_, index) => `$${index + 1}`).join(', ');
  const updates = spec.updateColumns
    .map((column) => `${quoteIdentifier(column)} = EXCLUDED.${quoteIdentifier(column)}`)
    .join(', ');

  return `INSERT INTO ${quoteIdentifier(spec.name)} (${joinIdentifiers(spec.columns)}) VALUES (${placeholders}) ON CONFLICT ${spec.conflictTarget} DO UPDATE SET ${updates}`;
}

/**
 * @param {string} specName
 * @returns {TableSpec}
 */
function getTableSpec(specName) {
  const spec = POSTGRES_TABLE_SPECS.find((candidate) => candidate.name === specName);

  if (!spec) {
    throw new Error(`Unknown postgres table spec: ${specName}`);
  }

  return spec;
}

/**
 * @param {string} name
 * @returns {string}
 */
function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required when METADATA_STORE_BACKEND=postgres.`);
  }

  return value;
}

/**
 * @template T
 * @param {T | undefined} value
 * @param {string} label
 * @returns {T}
 */
function requireValue(value, label) {
  if (value === undefined) {
    throw new Error(`${label} was required but not found.`);
  }

  return value;
}

/**
 * @param {{ telemetry?: any, message: string, data?: Record<string, unknown> }} options
 */
function warnMirrorIssue(options) {
  if (typeof options.telemetry?.warn === 'function') {
    options.telemetry.warn('metadata-store.postgres-mirror-warning', {
      message: options.message,
      ...(options.data ?? {}),
    });
    return;
  }

  console.warn(options.message, options.data ?? '');
}

/**
 * @param {{ telemetry?: any, error: unknown, data?: Record<string, unknown> }} options
 */
function reportMirrorFailure(options) {
  const message = options.error instanceof Error ? options.error.message : String(options.error);

  if (typeof options.telemetry?.error === 'function') {
    options.telemetry.error('metadata-store.postgres-mirror-failed', {
      message,
      ...(options.data ?? {}),
    });
    return;
  }

  console.error('metadata-store.postgres-mirror-failed', message, options.data ?? '');
}

export class PostgresMirroredPlatformStore extends PlatformStore {
  /**
   * @param {{
   *   rootDir?: string,
   *   dbFilePath?: string,
   *   objectStoreDir?: string,
   *   objectStorage?: any,
   *   postgresPool?: { query: (sql: string, values?: unknown[]) => Promise<{ rows?: any[] }>, end?: () => Promise<void> },
   *   telemetry?: any,
   *   managePool?: boolean,
   * }} [options]
   */
  constructor(options = {}) {
    super(options);
    this.postgresPool = requireValue(options.postgresPool, 'postgresPool');
    this.telemetry = options.telemetry;
    this.managePool = options.managePool ?? false;
    this.pendingMirrors = new Set();
    this.lastMirrorError = null;
    this.closed = false;
  }

  /**
   * @param {{
   *   rootDir?: string,
   *   dbFilePath?: string,
   *   objectStoreDir?: string,
   *   objectStorage?: any,
   *   postgresUrl?: string,
   *   postgresPool?: { query: (sql: string, values?: unknown[]) => Promise<{ rows?: any[] }>, end?: () => Promise<void> },
   *   telemetry?: any,
   * }} [options]
   */
  static async create(options = {}) {
    const postgresPool = options.postgresPool ?? new Pool({
      connectionString: options.postgresUrl ?? requireEnv('MANAGED_POSTGRES_URL'),
    });
    const store = new PostgresMirroredPlatformStore({
      ...options,
      postgresPool,
      managePool: !options.postgresPool,
    });

    try {
      await store.initialize();
      return store;
    } catch (error) {
      await store.closeAsync().catch(() => {});
      throw error;
    }
  }

  async initialize() {
    await this.applyPostgresMigrations();
    await this.seedPostgresRetentionPoliciesAsync();

    if (await this.isPostgresMetadataEmpty()) {
      await this.mirrorLocalCacheToPostgres();
      return;
    }

    await this.hydrateLocalCacheFromPostgres();
  }

  async applyPostgresMigrations() {
    await this.postgresPool.query('CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
    const appliedRows = await this.postgresPool.query('SELECT id FROM schema_migrations ORDER BY id ASC');
    const appliedMigrationIds = new Set((appliedRows.rows ?? []).map((row) => row.id));
    const migrationsDir = path.join(this.rootDir, 'infra', 'migrations');
    const migrationFiles = readdirSync(migrationsDir).filter((fileName) => fileName.endsWith('.sql')).sort();

    for (const fileName of migrationFiles) {
      if (appliedMigrationIds.has(fileName)) {
        continue;
      }

      await this.postgresPool.query(readFileSync(path.join(migrationsDir, fileName), 'utf8'));
      await this.postgresPool.query(
        'INSERT INTO schema_migrations (id, applied_at) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING',
        [fileName, new Date().toISOString()],
      );
    }
  }

  async seedPostgresRetentionPoliciesAsync() {
    const spec = getTableSpec('retention_policies');
    const sql = createPostgresUpsertSql(spec);
    const rows = this.db.prepare(`SELECT ${spec.columns.join(', ')} FROM retention_policies`).all();

    for (const row of rows) {
      await this.postgresPool.query(sql, spec.columns.map((column) => row[column] ?? null));
    }
  }

  async isPostgresMetadataEmpty() {
    const result = await this.postgresPool.query('SELECT COUNT(*)::int AS count FROM workflow_runs');
    return Number(result.rows?.[0]?.count ?? 0) === 0;
  }

  async hydrateLocalCacheFromPostgres() {
    this.withTransaction(() => {
      this.db.exec('PRAGMA foreign_keys = OFF;');

      try {
        for (const tableName of SQLITE_CLEAR_ORDER) {
          this.db.prepare(`DELETE FROM ${tableName}`).run();
        }
      } finally {
        this.db.exec('PRAGMA foreign_keys = ON;');
      }
    });

    for (const spec of POSTGRES_TABLE_SPECS) {
      const result = await this.postgresPool.query(
        `SELECT ${joinIdentifiers(spec.columns)} FROM ${quoteIdentifier(spec.name)}`,
      );
      const sqliteInsert = this.db.prepare(
        `INSERT OR REPLACE INTO ${quoteIdentifier(spec.name)} (${joinIdentifiers(spec.columns)}) VALUES (${spec.columns.map(() => '?').join(', ')})`,
      );

      this.withTransaction(() => {
        for (const row of result.rows ?? []) {
          sqliteInsert.run(...spec.columns.map((column) => row[column] ?? null));
        }
      });
    }
  }

  async mirrorLocalCacheToPostgres() {
    for (const spec of POSTGRES_TABLE_SPECS) {
      const rows = this.db.prepare(`SELECT ${spec.columns.join(', ')} FROM ${spec.name}`).all();
      const sql = createPostgresUpsertSql(spec);

      for (const row of rows) {
        await this.postgresPool.query(sql, spec.columns.map((column) => row[column] ?? null));
      }
    }
  }

  /**
   * @param {() => Promise<void>} work
   * @param {Record<string, unknown>} [data]
   */
  scheduleMirror(work, data = {}) {
    const promise = Promise.resolve()
      .then(work)
      .catch((error) => {
        this.lastMirrorError = error;
        reportMirrorFailure({
          telemetry: this.telemetry,
          error,
          data,
        });
      })
      .finally(() => {
        this.pendingMirrors.delete(promise);
      });

    this.pendingMirrors.add(promise);
  }

  async flushMirrors() {
    await Promise.allSettled([...this.pendingMirrors]);
  }

  async closeAsync() {
    if (this.closed) {
      return;
    }

    this.closed = true;
    await this.flushMirrors();
    super.close();

    if (this.managePool && typeof this.postgresPool?.end === 'function') {
      await this.postgresPool.end();
    }
  }

  close() {
    if (this.closed) {
      return;
    }

    this.closed = true;
    super.close();

    if (this.managePool && typeof this.postgresPool?.end === 'function') {
      void this.postgresPool.end().catch((error) => {
        reportMirrorFailure({
          telemetry: this.telemetry,
          error,
          data: {
            action: 'postgres-pool-close',
          },
        });
      });
    }
  }

  /**
   * @param {string} specName
   * @param {unknown[]} values
   * @param {Record<string, unknown>} [data]
   */
  mirrorRow(specName, values, data = {}) {
    const spec = getTableSpec(specName);

    this.scheduleMirror(
      () => this.postgresPool.query(createPostgresUpsertSql(spec), values).then(() => undefined),
      {
        table: specName,
        ...data,
      },
    );
  }

  /**
   * @param {string} sql
   * @param {unknown[]} values
   * @param {Record<string, unknown>} [data]
   */
  mirrorDelete(sql, values, data = {}) {
    this.scheduleMirror(
      () => this.postgresPool.query(sql, values).then(() => undefined),
      data,
    );
  }

  /**
   * @param {any} project
   * @returns {any}
   */
  saveProject(project) {
    const savedProject = super.saveProject(project);
    const row = requireValue(this.db.prepare(
      'SELECT id, tenant_id, title, status, active_workflow_run_id, created_at, updated_at, version, payload_json FROM projects WHERE id = ?',
    ).get(savedProject.id), `projects.${savedProject.id}`);
    this.mirrorRow('projects', [
      row.id,
      row.tenant_id,
      row.title,
      row.status,
      row.active_workflow_run_id,
      row.created_at,
      row.updated_at,
      row.version,
      row.payload_json,
    ], {
      projectId: savedProject.id,
    });
    return savedProject;
  }

  /**
   * @param {any} workflowRun
   * @returns {any}
   */
  saveWorkflowRun(workflowRun) {
    const savedWorkflowRun = super.saveWorkflowRun(workflowRun);
    const row = requireValue(this.db.prepare(
      'SELECT id, tenant_id, project_id, state, current_stage, created_at, updated_at, version, payload_json FROM workflow_runs WHERE id = ?',
    ).get(savedWorkflowRun.id), `workflow_runs.${savedWorkflowRun.id}`);
    this.mirrorRow('workflow_runs', [
      row.id,
      row.tenant_id,
      row.project_id,
      row.state,
      row.current_stage,
      row.created_at,
      row.updated_at,
      row.version,
      row.payload_json,
    ], {
      workflowRunId: savedWorkflowRun.id,
    });
    return savedWorkflowRun;
  }

  /**
   * @param {any} workflowEvent
   * @returns {any}
   */
  appendWorkflowEvent(workflowEvent) {
    const savedWorkflowEvent = super.appendWorkflowEvent(workflowEvent);
    const row = requireValue(this.db.prepare(
      'SELECT id, workflow_run_id, event_type, occurred_at, payload_json FROM workflow_events WHERE id = ?',
    ).get(savedWorkflowEvent.id), `workflow_events.${savedWorkflowEvent.id}`);
    this.mirrorRow('workflow_events', [
      row.id,
      row.workflow_run_id,
      row.event_type,
      row.occurred_at,
      row.payload_json,
    ], {
      workflowRunId: savedWorkflowEvent.workflowRunId,
      eventId: savedWorkflowEvent.id,
    });
    return savedWorkflowEvent;
  }

  /**
   * @param {string} artifactType
   * @param {string} artifactId
   * @param {any} artifact
   * @param {{ tenantId?: string, retentionClass?: string }} [options]
   * @returns {any}
   */
  saveArtifact(artifactType, artifactId, artifact, options = {}) {
    const savedArtifact = super.saveArtifact(artifactType, artifactId, artifact, options);
    const metadata = this.getArtifactMetadata(artifactType, artifactId);

    if (metadata) {
      this.mirrorRow('artifacts', [
        metadata.artifactType,
        metadata.artifactId,
        metadata.tenantId,
        metadata.contentType,
        metadata.location,
        metadata.checksum,
        metadata.retentionClass,
        metadata.createdAt,
        JSON.stringify(savedArtifact, null, 2),
      ], {
        artifactType,
        artifactId,
      });
    }

    return savedArtifact;
  }

  /**
   * @param {string} documentType
   * @param {string} documentId
   * @param {string | Buffer} contents
   * @param {{ tenantId?: string, contentType?: string, extension?: string, retentionClass?: string }} [options]
   * @returns {{ location: string, checksum: string, contentType: string, retentionClass: string }}
   */
  saveDocument(documentType, documentId, contents, options = {}) {
    const metadata = super.saveDocument(documentType, documentId, contents, options);
    const documentMetadata = this.getDocumentMetadata(documentType, documentId);

    if (documentMetadata) {
      this.mirrorRow('documents', [
        documentMetadata.documentType,
        documentMetadata.documentId,
        documentMetadata.tenantId,
        documentMetadata.contentType,
        documentMetadata.location,
        documentMetadata.checksum,
        documentMetadata.retentionClass,
        requireValue(this.db.prepare(
          'SELECT created_at FROM documents WHERE document_type = ? AND document_id = ?',
        ).get(documentType, documentId), `documents.${documentType}:${documentId}`).created_at,
      ], {
        documentType,
        documentId,
      });
    }

    return metadata;
  }

  /**
   * @param {any} auditLogEntry
   * @param {{ tenantId?: string }} [options]
   * @returns {any}
   */
  appendAuditLogEntry(auditLogEntry, options = {}) {
    const savedEntry = super.appendAuditLogEntry(auditLogEntry, options);
    const row = requireValue(this.db.prepare(
      'SELECT id, tenant_id, subject_type, subject_id, action, outcome, occurred_at, payload_json FROM audit_log_entries WHERE id = ?',
    ).get(savedEntry.id), `audit_log_entries.${savedEntry.id}`);
    this.mirrorRow('audit_log_entries', [
      row.id,
      row.tenant_id,
      row.subject_type,
      row.subject_id,
      row.action,
      row.outcome,
      row.occurred_at,
      row.payload_json,
    ], {
      auditLogEntryId: savedEntry.id,
    });
    return savedEntry;
  }

  /**
   * @param {any} exportHistoryEntry
   * @returns {any}
   */
  saveExportHistoryEntry(exportHistoryEntry) {
    const savedEntry = super.saveExportHistoryEntry(exportHistoryEntry);
    const row = requireValue(this.db.prepare(
      'SELECT id, release_id, workflow_run_id, tenant_id, exported_by, exported_at, status, bundle_location, bundle_index_location, payload_json FROM export_history WHERE id = ?',
    ).get(savedEntry.id), `export_history.${savedEntry.id}`);
    this.mirrorRow('export_history', [
      row.id,
      row.release_id,
      row.workflow_run_id,
      row.tenant_id,
      row.exported_by,
      row.exported_at,
      row.status,
      row.bundle_location,
      row.bundle_index_location,
      row.payload_json,
    ], {
      releaseId: savedEntry.releaseId,
    });
    return savedEntry;
  }

  /**
   * @param {any} tenant
   * @returns {any}
   */
  saveTenant(tenant) {
    const savedTenant = super.saveTenant(tenant);
    const row = requireValue(this.db.prepare(
      'SELECT id, slug, display_name, status, sso_mode, retention_defaults_json, created_at, updated_at FROM tenants WHERE id = ?',
    ).get(savedTenant.id), `tenants.${savedTenant.id}`);
    this.mirrorRow('tenants', [
      row.id,
      row.slug,
      row.display_name,
      row.status,
      row.sso_mode,
      row.retention_defaults_json,
      row.created_at,
      row.updated_at,
    ], {
      tenantId: savedTenant.id,
    });
    return savedTenant;
  }

  /**
   * @param {any} user
   * @param {{ passwordHash?: string | null, subject?: string }} [options]
   * @returns {any}
   */
  saveUserAccount(user, options = {}) {
    const savedUser = super.saveUserAccount(user, options);
    const userRow = requireValue(this.db.prepare(
      'SELECT id, email, display_name, status, auth_provider, subject, password_hash, created_at, updated_at FROM users WHERE id = ?',
    ).get(savedUser.id), `users.${savedUser.id}`);
    const membershipRow = requireValue(this.db.prepare(
      'SELECT tenant_id, user_id, roles_json, created_at, updated_at FROM memberships WHERE tenant_id = ? AND user_id = ?',
    ).get(savedUser.tenantId, savedUser.id), `memberships.${savedUser.tenantId}:${savedUser.id}`);

    this.mirrorRow('users', [
      userRow.id,
      userRow.email,
      userRow.display_name,
      userRow.status,
      userRow.auth_provider,
      userRow.subject,
      userRow.password_hash,
      userRow.created_at,
      userRow.updated_at,
    ], {
      userId: savedUser.id,
    });

    this.mirrorRow('memberships', [
      membershipRow.tenant_id,
      membershipRow.user_id,
      membershipRow.roles_json,
      membershipRow.created_at,
      membershipRow.updated_at,
    ], {
      userId: savedUser.id,
      tenantId: savedUser.tenantId,
    });

    return savedUser;
  }

  /**
   * @param {string} tenantId
   * @param {string} userId
   * @param {string[]} roles
   * @param {string} [createdAt]
   * @param {string} [updatedAt]
   * @returns {void}
   */
  saveMembership(tenantId, userId, roles, createdAt = new Date().toISOString(), updatedAt = createdAt) {
    super.saveMembership(tenantId, userId, roles, createdAt, updatedAt);
    const row = requireValue(this.db.prepare(
      'SELECT tenant_id, user_id, roles_json, created_at, updated_at FROM memberships WHERE tenant_id = ? AND user_id = ?',
    ).get(tenantId, userId), `memberships.${tenantId}:${userId}`);
    this.mirrorRow('memberships', [
      row.tenant_id,
      row.user_id,
      row.roles_json,
      row.created_at,
      row.updated_at,
    ], {
      tenantId,
      userId,
    });
  }

  /**
   * @param {any} session
   * @param {string} tokenHash
   * @param {Record<string, unknown>} [metadata]
   * @returns {any}
   */
  createSession(session, tokenHash, metadata = {}) {
    const savedSession = super.createSession(session, tokenHash, metadata);
    const row = requireValue(this.db.prepare(
      'SELECT id, tenant_id, user_id, token_hash, auth_method, expires_at, created_at, last_seen_at, metadata_json FROM sessions WHERE id = ?',
    ).get(savedSession.id), `sessions.${savedSession.id}`);
    this.mirrorRow('sessions', [
      row.id,
      row.tenant_id,
      row.user_id,
      row.token_hash,
      row.auth_method,
      row.expires_at,
      row.created_at,
      row.last_seen_at,
      row.metadata_json,
    ], {
      sessionId: savedSession.id,
    });
    return savedSession;
  }

  /**
   * @param {string} sessionId
   * @param {string} lastSeenAt
   * @returns {void}
   */
  touchSession(sessionId, lastSeenAt) {
    super.touchSession(sessionId, lastSeenAt);
    const row = this.db.prepare(
      'SELECT id, tenant_id, user_id, token_hash, auth_method, expires_at, created_at, last_seen_at, metadata_json FROM sessions WHERE id = ?',
    ).get(sessionId);

    if (!row) {
      warnMirrorIssue({
        telemetry: this.telemetry,
        message: 'Session touch completed locally but the session row was missing during postgres mirroring.',
        data: { sessionId },
      });
      return;
    }

    this.mirrorRow('sessions', [
      row.id,
      row.tenant_id,
      row.user_id,
      row.token_hash,
      row.auth_method,
      row.expires_at,
      row.created_at,
      row.last_seen_at,
      row.metadata_json,
    ], {
      sessionId,
    });
  }

  /**
   * @param {string} tokenHash
   * @returns {void}
   */
  deleteSessionByTokenHash(tokenHash) {
    super.deleteSessionByTokenHash(tokenHash);
    this.mirrorDelete(
      'DELETE FROM sessions WHERE token_hash = $1',
      [tokenHash],
      {
        tokenHash,
      },
    );
  }
}

/**
 * @param {{
 *   rootDir?: string,
 *   dbFilePath?: string,
 *   objectStoreDir?: string,
 *   objectStorage?: any,
 *   metadataStoreKind?: string,
 *   postgresUrl?: string,
 *   postgresPool?: { query: (sql: string, values?: unknown[]) => Promise<{ rows?: any[] }>, end?: () => Promise<void> },
 *   telemetry?: any,
 * }} [options]
 * @returns {Promise<PlatformStore | PostgresMirroredPlatformStore>}
 */
export async function createMetadataStore(options = {}) {
  const metadataStoreKind = options.metadataStoreKind ?? process.env.METADATA_STORE_BACKEND ?? 'sqlite';

  if (metadataStoreKind === 'postgres') {
    return PostgresMirroredPlatformStore.create(options);
  }

  return new PlatformStore(options);
}
