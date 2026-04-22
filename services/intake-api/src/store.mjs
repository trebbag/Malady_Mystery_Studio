import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { findRepoRoot } from '../../../packages/shared-config/src/repo-paths.mjs';
import { ObjectStorage } from './object-storage.mjs';

const DEFAULT_RETENTION_POLICIES = [
  {
    retentionClass: 'approved-artifact',
    description: 'Approved workflow artifacts and exportable deliverables.',
    defaultDays: 365,
  },
  {
    retentionClass: 'audit-log',
    description: 'Restricted audit trail for privileged and export actions.',
    defaultDays: 2555,
  },
  {
    retentionClass: 'session',
    description: 'Authentication sessions and revocation metadata.',
    defaultDays: 14,
  },
  {
    retentionClass: 'release-bundle',
    description: 'Completed release bundles and bundle indexes.',
    defaultDays: 1095,
  },
];

/** @type {Record<string, string>} */
const ARTIFACT_RETENTION_CLASS = {
  'release-bundle': 'release-bundle',
};

/**
 * @template T
 * @param {T} value
 * @returns {T}
 */
function clone(value) {
  return structuredClone(value);
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, any>}
 */
function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function serialize(value) {
  return JSON.stringify(value, null, 2);
}

/**
 * @param {string | null} value
 * @returns {any}
 */
function parseJsonColumn(value) {
  return value ? JSON.parse(value) : null;
}

/**
 * @param {Record<string, any>} row
 * @returns {any}
 */
function rowPayload(row) {
  return parseJsonColumn(asNullableString(row.payload_json, 'payload_json'));
}

/**
 * @param {string | null | undefined} value
 * @returns {string}
 */
function normalizeTenantId(value) {
  return value ?? 'tenant.demo';
}

/**
 * @param {import('node:sqlite').SQLOutputValue} value
 * @param {string} label
 * @returns {string}
 */
function asString(value, label) {
  if (typeof value !== 'string') {
    throw new TypeError(`${label} must be a string.`);
  }

  return value;
}

/**
 * @param {import('node:sqlite').SQLOutputValue} value
 * @param {string} label
 * @returns {string | null}
 */
function asNullableString(value, label) {
  if (value == null) {
    return null;
  }

  return asString(value, label);
}

export class PlatformStore {
  /**
   * @param {{ rootDir?: string, dbFilePath?: string, objectStoreDir?: string }} [options]
   */
  constructor(options = {}) {
    this.rootDir = options.rootDir ?? findRepoRoot(import.meta.url);
    this.dbFilePath = options.dbFilePath ?? path.join(this.rootDir, 'var', 'db', 'platform.sqlite');
    this.objectStoreDir = options.objectStoreDir ?? path.join(this.rootDir, 'var', 'object-store');
    mkdirSync(path.dirname(this.dbFilePath), { recursive: true });
    mkdirSync(this.objectStoreDir, { recursive: true });
    this.db = new DatabaseSync(this.dbFilePath);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec('PRAGMA busy_timeout = 5000;');
    this.objectStorage = new ObjectStorage({ baseDir: this.objectStoreDir });
    this.applyMigrations();
    this.seedRetentionPolicies();
  }

  close() {
    this.db.close();
  }

  applyMigrations() {
    this.db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL);');
    const appliedMigrationIds = new Set(
      this.db.prepare('SELECT id FROM schema_migrations ORDER BY id ASC').all().map((row) => row.id),
    );
    const migrationsDir = path.join(this.rootDir, 'infra', 'migrations');
    const migrationFiles = readdirSync(migrationsDir).filter((fileName) => fileName.endsWith('.sql')).sort();

    for (const fileName of migrationFiles) {
      if (appliedMigrationIds.has(fileName)) {
        continue;
      }

      const migrationSql = readFileSync(path.join(migrationsDir, fileName), 'utf8');
      const appliedAt = new Date().toISOString();

      this.withTransaction(() => {
        this.db.exec(migrationSql);
        this.db.prepare('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)').run(fileName, appliedAt);
      });
    }
  }

  seedRetentionPolicies() {
    const statement = this.db.prepare(`
      INSERT INTO retention_policies (retention_class, description, default_days)
      VALUES (?, ?, ?)
      ON CONFLICT(retention_class) DO UPDATE SET
        description = excluded.description,
        default_days = excluded.default_days
    `);

    for (const policy of DEFAULT_RETENTION_POLICIES) {
      statement.run(policy.retentionClass, policy.description, policy.defaultDays);
    }
  }

  /**
   * @template T
   * @param {() => T} work
   * @returns {T}
   */
  withTransaction(work) {
    this.db.exec('BEGIN IMMEDIATE');

    try {
      const result = work();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  /**
   * @param {string} artifactType
   * @returns {string}
   */
  getRetentionClassForArtifactType(artifactType) {
    return ARTIFACT_RETENTION_CLASS[artifactType] ?? 'approved-artifact';
  }

  /**
   * @param {any} project
   * @returns {any}
   */
  saveProject(project) {
    const tenantId = normalizeTenantId(project.tenantId);
    this.db.prepare(`
      INSERT INTO projects (id, tenant_id, title, status, active_workflow_run_id, created_at, updated_at, payload_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        tenant_id = excluded.tenant_id,
        title = excluded.title,
        status = excluded.status,
        active_workflow_run_id = excluded.active_workflow_run_id,
        updated_at = excluded.updated_at,
        version = projects.version + 1,
        payload_json = excluded.payload_json
    `).run(
      project.id,
      tenantId,
      project.title,
      project.status,
      project.activeWorkflowRunId ?? null,
      project.createdAt,
      project.updatedAt,
      serialize({
        ...project,
        tenantId,
      }),
    );

    return clone({
      ...project,
      tenantId,
    });
  }

  /**
   * @param {string} projectId
   * @returns {any | null}
   */
  getProject(projectId) {
    const row = this.db.prepare('SELECT payload_json FROM projects WHERE id = ?').get(projectId);
    return row ? rowPayload(row) : null;
  }

  /**
   * @returns {any[]}
   */
  listProjects() {
    return this.db.prepare('SELECT payload_json FROM projects ORDER BY updated_at DESC').all().map((row) => rowPayload(row));
  }

  /**
   * @param {any} workflowRun
   * @returns {any}
   */
  saveWorkflowRun(workflowRun) {
    const tenantId = normalizeTenantId(workflowRun.tenantId);
    this.db.prepare(`
      INSERT INTO workflow_runs (id, tenant_id, project_id, state, current_stage, created_at, updated_at, payload_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        tenant_id = excluded.tenant_id,
        project_id = excluded.project_id,
        state = excluded.state,
        current_stage = excluded.current_stage,
        updated_at = excluded.updated_at,
        version = workflow_runs.version + 1,
        payload_json = excluded.payload_json
    `).run(
      workflowRun.id,
      tenantId,
      workflowRun.projectId,
      workflowRun.state,
      workflowRun.currentStage,
      workflowRun.createdAt,
      workflowRun.updatedAt,
      serialize({
        ...workflowRun,
        tenantId,
      }),
    );

    return clone({
      ...workflowRun,
      tenantId,
    });
  }

  /**
   * @param {string} workflowRunId
   * @returns {any | null}
   */
  getWorkflowRun(workflowRunId) {
    const row = this.db.prepare('SELECT payload_json FROM workflow_runs WHERE id = ?').get(workflowRunId);
    return row ? rowPayload(row) : null;
  }

  /**
   * @returns {any[]}
   */
  listWorkflowRuns() {
    return this.db.prepare('SELECT payload_json FROM workflow_runs ORDER BY updated_at DESC').all().map((row) => rowPayload(row));
  }

  /**
   * @param {any} workflowEvent
   * @returns {any}
   */
  appendWorkflowEvent(workflowEvent) {
    this.db.prepare(`
      INSERT INTO workflow_events (id, workflow_run_id, event_type, occurred_at, payload_json)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        payload_json = excluded.payload_json
    `).run(
      workflowEvent.id,
      workflowEvent.workflowRunId,
      workflowEvent.eventType,
      workflowEvent.occurredAt,
      serialize(workflowEvent),
    );

    return clone(workflowEvent);
  }

  /**
   * @param {string} workflowRunId
   * @returns {any[]}
   */
  listWorkflowEvents(workflowRunId) {
    return this.db.prepare(
      'SELECT payload_json FROM workflow_events WHERE workflow_run_id = ? ORDER BY occurred_at ASC',
    ).all(workflowRunId).map((row) => rowPayload(row));
  }

  /**
   * @param {string} artifactType
   * @param {string} artifactId
   * @returns {string}
   */
  createArtifactKey(artifactType, artifactId) {
    return `${artifactType}:${artifactId}`;
  }

  /**
   * @param {string} artifactType
   * @param {string} artifactId
   * @param {any} artifact
   * @param {{ tenantId?: string, retentionClass?: string }} [options]
   * @returns {any}
   */
  saveArtifact(artifactType, artifactId, artifact, options = {}) {
    const tenantId = normalizeTenantId(options.tenantId ?? artifact.tenantId);
    const storedObject = this.objectStorage.putObject(
      tenantId,
      artifactType,
      artifactId,
      serialize(artifact),
      { extension: 'json' },
    );
    const createdAt = artifact.createdAt ?? artifact.occurredAt ?? artifact.updatedAt ?? new Date().toISOString();
    const retentionClass = options.retentionClass ?? this.getRetentionClassForArtifactType(artifactType);

    this.db.prepare(`
      INSERT INTO artifacts (artifact_type, artifact_id, tenant_id, content_type, location, checksum, retention_class, created_at, payload_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(artifact_type, artifact_id) DO UPDATE SET
        tenant_id = excluded.tenant_id,
        content_type = excluded.content_type,
        location = excluded.location,
        checksum = excluded.checksum,
        retention_class = excluded.retention_class,
        payload_json = excluded.payload_json
    `).run(
      artifactType,
      artifactId,
      tenantId,
      'application/json',
      storedObject.location,
      storedObject.checksum,
      retentionClass,
      createdAt,
      serialize(artifact),
    );

    return clone(artifact);
  }

  /**
   * @param {string} artifactType
   * @param {string} artifactId
   * @returns {any | null}
   */
  getArtifact(artifactType, artifactId) {
    const row = this.db.prepare(
      'SELECT location FROM artifacts WHERE artifact_type = ? AND artifact_id = ?',
    ).get(artifactType, artifactId);

    if (!row) {
      return null;
    }

    return this.objectStorage.getJson(asString(row.location, 'artifacts.location'));
  }

  /**
   * @param {string} artifactType
   * @param {string} artifactId
   * @returns {{ artifactType: string, artifactId: string, tenantId: string, contentType: string, location: string, checksum: string, retentionClass: string, createdAt: string } | null}
   */
  getArtifactMetadata(artifactType, artifactId) {
    const row = this.db.prepare(`
      SELECT artifact_type, artifact_id, tenant_id, content_type, location, checksum, retention_class, created_at
      FROM artifacts
      WHERE artifact_type = ? AND artifact_id = ?
    `).get(artifactType, artifactId);

    return row ? {
      artifactType: asString(row.artifact_type, 'artifacts.artifact_type'),
      artifactId: asString(row.artifact_id, 'artifacts.artifact_id'),
      tenantId: asString(row.tenant_id, 'artifacts.tenant_id'),
      contentType: asString(row.content_type, 'artifacts.content_type'),
      location: asString(row.location, 'artifacts.location'),
      checksum: asString(row.checksum, 'artifacts.checksum'),
      retentionClass: asString(row.retention_class, 'artifacts.retention_class'),
      createdAt: asString(row.created_at, 'artifacts.created_at'),
    } : null;
  }

  /**
   * @param {string} artifactType
   * @param {{ tenantId?: string }} [filters]
   * @returns {any[]}
   */
  listArtifactsByType(artifactType, filters = {}) {
    let sql = 'SELECT location FROM artifacts WHERE artifact_type = ?';
    /** @type {any[]} */
    const parameters = [artifactType];

    if (filters.tenantId) {
      sql += ' AND tenant_id = ?';
      parameters.push(normalizeTenantId(filters.tenantId));
    }

    sql += ' ORDER BY created_at DESC';
    return this.db.prepare(sql).all(...parameters).map((row) => this.objectStorage.getJson(asString(row.location, 'artifacts.location')));
  }

  /**
   * @param {string} documentType
   * @param {string} documentId
   * @param {string} contents
   * @param {{ tenantId?: string, contentType?: string, extension?: string, retentionClass?: string }} [options]
   * @returns {{ location: string, checksum: string, contentType: string, retentionClass: string }}
   */
  saveDocument(documentType, documentId, contents, options = {}) {
    const tenantId = normalizeTenantId(options.tenantId);
    const contentType = options.contentType ?? 'text/markdown';
    const extension = options.extension ?? 'md';
    const retentionClass = options.retentionClass ?? 'release-bundle';
    const storedObject = this.objectStorage.putObject(tenantId, documentType, documentId, contents, { extension });
    const createdAt = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO documents (document_type, document_id, tenant_id, content_type, location, checksum, retention_class, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(document_type, document_id) DO UPDATE SET
        tenant_id = excluded.tenant_id,
        content_type = excluded.content_type,
        location = excluded.location,
        checksum = excluded.checksum,
        retention_class = excluded.retention_class
    `).run(
      documentType,
      documentId,
      tenantId,
      contentType,
      storedObject.location,
      storedObject.checksum,
      retentionClass,
      createdAt,
    );

    return {
      location: storedObject.location,
      checksum: storedObject.checksum,
      contentType,
      retentionClass,
    };
  }

  /**
   * @param {string} documentType
   * @param {string} documentId
   * @returns {string | null}
   */
  getDocument(documentType, documentId) {
    const row = this.db.prepare(
      'SELECT location FROM documents WHERE document_type = ? AND document_id = ?',
    ).get(documentType, documentId);

    return row ? this.objectStorage.getText(asString(row.location, 'documents.location')) : null;
  }

  /**
   * @param {string} documentType
   * @param {string} documentId
   * @returns {{ documentType: string, documentId: string, tenantId: string, contentType: string, location: string, checksum: string, retentionClass: string } | null}
   */
  getDocumentMetadata(documentType, documentId) {
    const row = this.db.prepare(`
      SELECT document_type, document_id, tenant_id, content_type, location, checksum, retention_class
      FROM documents
      WHERE document_type = ? AND document_id = ?
    `).get(documentType, documentId);

    return row ? {
      documentType: asString(row.document_type, 'documents.document_type'),
      documentId: asString(row.document_id, 'documents.document_id'),
      tenantId: asString(row.tenant_id, 'documents.tenant_id'),
      contentType: asString(row.content_type, 'documents.content_type'),
      location: asString(row.location, 'documents.location'),
      checksum: asString(row.checksum, 'documents.checksum'),
      retentionClass: asString(row.retention_class, 'documents.retention_class'),
    } : null;
  }

  /**
   * @param {any} auditLogEntry
   * @param {{ tenantId?: string }} [options]
   * @returns {any}
   */
  appendAuditLogEntry(auditLogEntry, options = {}) {
    this.db.prepare(`
      INSERT INTO audit_log_entries (id, tenant_id, subject_type, subject_id, action, outcome, occurred_at, payload_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        payload_json = excluded.payload_json
    `).run(
      auditLogEntry.id,
      normalizeTenantId(options.tenantId ?? auditLogEntry.tenantId),
      auditLogEntry.subjectType,
      auditLogEntry.subjectId,
      auditLogEntry.action,
      auditLogEntry.outcome,
      auditLogEntry.occurredAt,
      serialize(auditLogEntry),
    );

    return clone(auditLogEntry);
  }

  /**
   * @param {{ subjectId?: string, subjectType?: string, tenantId?: string }} [filters]
   * @returns {any[]}
   */
  listAuditLogEntries(filters = {}) {
    let sql = 'SELECT payload_json FROM audit_log_entries WHERE 1 = 1';
    /** @type {any[]} */
    const parameters = [];

    if (filters.tenantId) {
      sql += ' AND tenant_id = ?';
      parameters.push(normalizeTenantId(filters.tenantId));
    }

    if (filters.subjectId) {
      sql += ' AND subject_id = ?';
      parameters.push(filters.subjectId);
    }

    if (filters.subjectType) {
      sql += ' AND subject_type = ?';
      parameters.push(filters.subjectType);
    }

    sql += ' ORDER BY occurred_at ASC';
    return this.db.prepare(sql).all(...parameters).map((row) => rowPayload(row));
  }

  /**
   * @param {any} exportHistoryEntry
   * @returns {any}
   */
  saveExportHistoryEntry(exportHistoryEntry) {
    this.db.prepare(`
      INSERT INTO export_history (id, release_id, workflow_run_id, tenant_id, exported_by, exported_at, status, bundle_location, bundle_index_location, payload_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        payload_json = excluded.payload_json,
        status = excluded.status,
        bundle_location = excluded.bundle_location,
        bundle_index_location = excluded.bundle_index_location
    `).run(
      exportHistoryEntry.id,
      exportHistoryEntry.releaseId,
      exportHistoryEntry.workflowRunId,
      normalizeTenantId(exportHistoryEntry.tenantId),
      exportHistoryEntry.exportedBy,
      exportHistoryEntry.exportedAt,
      exportHistoryEntry.status,
      exportHistoryEntry.bundleLocation,
      exportHistoryEntry.bundleIndexLocation,
      serialize(exportHistoryEntry),
    );

    return clone(exportHistoryEntry);
  }

  /**
   * @param {string} workflowRunId
   * @returns {any[]}
   */
  listExportHistoryEntries(workflowRunId) {
    return this.db.prepare(
      'SELECT payload_json FROM export_history WHERE workflow_run_id = ? ORDER BY exported_at DESC',
    ).all(workflowRunId).map((row) => rowPayload(row));
  }

  /**
   * @param {string} releaseId
   * @returns {any | null}
   */
  getExportHistoryEntryByReleaseId(releaseId) {
    const row = this.db.prepare('SELECT payload_json FROM export_history WHERE release_id = ?').get(releaseId);
    return row ? rowPayload(row) : null;
  }

  /**
   * @param {any} tenant
   * @returns {any}
   */
  saveTenant(tenant) {
    this.db.prepare(`
      INSERT INTO tenants (id, slug, display_name, status, sso_mode, retention_defaults_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        slug = excluded.slug,
        display_name = excluded.display_name,
        status = excluded.status,
        sso_mode = excluded.sso_mode,
        retention_defaults_json = excluded.retention_defaults_json,
        updated_at = excluded.updated_at
    `).run(
      tenant.id,
      tenant.slug,
      tenant.displayName,
      tenant.status,
      tenant.ssoMode,
      serialize(tenant.retentionDefaults ?? {}),
      tenant.createdAt,
      tenant.updatedAt,
    );

    return clone(tenant);
  }

  /**
   * @param {string} tenantId
   * @returns {any | null}
   */
  getTenant(tenantId) {
    const row = this.db.prepare(`
      SELECT id, slug, display_name, status, sso_mode, retention_defaults_json, created_at, updated_at
      FROM tenants
      WHERE id = ?
    `).get(tenantId);

    return row ? {
      schemaVersion: '1.0.0',
      id: asString(row.id, 'tenants.id'),
      slug: asString(row.slug, 'tenants.slug'),
      displayName: asString(row.display_name, 'tenants.display_name'),
      status: asString(row.status, 'tenants.status'),
      ssoMode: asString(row.sso_mode, 'tenants.sso_mode'),
      retentionDefaults: parseJsonColumn(asNullableString(row.retention_defaults_json, 'tenants.retention_defaults_json')),
      createdAt: asString(row.created_at, 'tenants.created_at'),
      updatedAt: asString(row.updated_at, 'tenants.updated_at'),
    } : null;
  }

  /**
   * @param {string} slug
   * @returns {any | null}
   */
  getTenantBySlug(slug) {
    const row = this.db.prepare('SELECT id FROM tenants WHERE slug = ?').get(slug);
    return row ? this.getTenant(asString(row.id, 'tenants.id')) : null;
  }

  /**
   * @returns {any[]}
   */
  listTenants() {
    return this.db.prepare('SELECT id FROM tenants ORDER BY created_at ASC').all()
      .map((row) => this.getTenant(asString(row.id, 'tenants.id')))
      .filter(Boolean);
  }

  /**
   * @param {any} user
   * @param {{ passwordHash?: string | null, subject?: string }} [options]
   * @returns {any}
   */
  saveUserAccount(user, options = {}) {
    const subject = options.subject ?? user.email;
    this.db.prepare(`
      INSERT INTO users (id, email, display_name, status, auth_provider, subject, password_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        email = excluded.email,
        display_name = excluded.display_name,
        status = excluded.status,
        auth_provider = excluded.auth_provider,
        subject = excluded.subject,
        password_hash = COALESCE(excluded.password_hash, users.password_hash),
        updated_at = excluded.updated_at
    `).run(
      user.id,
      user.email,
      user.displayName,
      user.status,
      user.authProvider,
      subject,
      options.passwordHash ?? null,
      user.createdAt,
      user.updatedAt,
    );
    this.saveMembership(user.tenantId, user.id, user.roles, user.createdAt, user.updatedAt);
    return clone(user);
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
    this.db.prepare(`
      INSERT INTO memberships (tenant_id, user_id, roles_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(tenant_id, user_id) DO UPDATE SET
        roles_json = excluded.roles_json,
        updated_at = excluded.updated_at
    `).run(
      normalizeTenantId(tenantId),
      userId,
      serialize(roles),
      createdAt,
      updatedAt,
    );
  }

  /**
   * @param {string} tenantId
   * @param {string} userId
   * @returns {any | null}
   */
  getUserAccount(userId, tenantId) {
    const row = this.db.prepare(`
      SELECT users.id, users.email, users.display_name, users.status, users.auth_provider, users.created_at, users.updated_at, memberships.roles_json
      FROM users
      JOIN memberships ON memberships.user_id = users.id
      WHERE users.id = ? AND memberships.tenant_id = ?
    `).get(userId, normalizeTenantId(tenantId));

    return row ? {
      schemaVersion: '1.0.0',
      id: asString(row.id, 'users.id'),
      tenantId: normalizeTenantId(tenantId),
      email: asString(row.email, 'users.email'),
      displayName: asString(row.display_name, 'users.display_name'),
      roles: parseJsonColumn(asNullableString(row.roles_json, 'memberships.roles_json')) ?? [],
      status: asString(row.status, 'users.status'),
      authProvider: asString(row.auth_provider, 'users.auth_provider'),
      createdAt: asString(row.created_at, 'users.created_at'),
      updatedAt: asString(row.updated_at, 'users.updated_at'),
    } : null;
  }

  /**
   * @param {string} tenantId
   * @param {string} email
   * @returns {{ user: any, passwordHash: string | null, subject: string } | null}
   */
  getAuthUserByEmail(tenantId, email) {
    const row = this.db.prepare(`
      SELECT users.id, users.email, users.display_name, users.status, users.auth_provider, users.subject, users.password_hash, users.created_at, users.updated_at, memberships.roles_json
      FROM users
      JOIN memberships ON memberships.user_id = users.id
      WHERE memberships.tenant_id = ? AND lower(users.email) = lower(?)
    `).get(normalizeTenantId(tenantId), email);

    return row ? {
      user: {
        schemaVersion: '1.0.0',
        id: asString(row.id, 'users.id'),
        tenantId: normalizeTenantId(tenantId),
        email: asString(row.email, 'users.email'),
        displayName: asString(row.display_name, 'users.display_name'),
        roles: parseJsonColumn(asNullableString(row.roles_json, 'memberships.roles_json')) ?? [],
        status: asString(row.status, 'users.status'),
        authProvider: asString(row.auth_provider, 'users.auth_provider'),
        createdAt: asString(row.created_at, 'users.created_at'),
        updatedAt: asString(row.updated_at, 'users.updated_at'),
      },
      passwordHash: asNullableString(row.password_hash, 'users.password_hash'),
      subject: asString(row.subject, 'users.subject'),
    } : null;
  }

  /**
   * @param {string} tenantId
   * @param {string} authProvider
   * @param {string} subject
   * @returns {{ user: any, passwordHash: string | null, subject: string } | null}
   */
  getAuthUserByProviderSubject(tenantId, authProvider, subject) {
    const row = this.db.prepare(`
      SELECT users.id, users.email, users.display_name, users.status, users.auth_provider, users.subject, users.password_hash, users.created_at, users.updated_at, memberships.roles_json
      FROM users
      JOIN memberships ON memberships.user_id = users.id
      WHERE memberships.tenant_id = ? AND users.auth_provider = ? AND users.subject = ?
    `).get(normalizeTenantId(tenantId), authProvider, subject);

    return row ? {
      user: {
        schemaVersion: '1.0.0',
        id: asString(row.id, 'users.id'),
        tenantId: normalizeTenantId(tenantId),
        email: asString(row.email, 'users.email'),
        displayName: asString(row.display_name, 'users.display_name'),
        roles: parseJsonColumn(asNullableString(row.roles_json, 'memberships.roles_json')) ?? [],
        status: asString(row.status, 'users.status'),
        authProvider: asString(row.auth_provider, 'users.auth_provider'),
        createdAt: asString(row.created_at, 'users.created_at'),
        updatedAt: asString(row.updated_at, 'users.updated_at'),
      },
      passwordHash: asNullableString(row.password_hash, 'users.password_hash'),
      subject: asString(row.subject, 'users.subject'),
    } : null;
  }

  /**
   * @param {string} tenantId
   * @returns {any[]}
   */
  listTenantUsers(tenantId) {
    return this.db.prepare(`
      SELECT users.id
      FROM users
      JOIN memberships ON memberships.user_id = users.id
      WHERE memberships.tenant_id = ?
      ORDER BY users.created_at ASC
    `).all(normalizeTenantId(tenantId))
      .map((row) => this.getUserAccount(asString(row.id, 'users.id'), tenantId))
      .filter(Boolean);
  }

  /**
   * @param {any} session
   * @param {string} tokenHash
   * @param {Record<string, unknown>} [metadata]
   * @returns {any}
   */
  createSession(session, tokenHash, metadata = {}) {
    this.db.prepare(`
      INSERT INTO sessions (id, tenant_id, user_id, token_hash, auth_method, expires_at, created_at, last_seen_at, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        token_hash = excluded.token_hash,
        auth_method = excluded.auth_method,
        expires_at = excluded.expires_at,
        last_seen_at = excluded.last_seen_at,
        metadata_json = excluded.metadata_json
    `).run(
      session.id,
      normalizeTenantId(session.tenantId),
      session.userId,
      tokenHash,
      session.authMethod,
      session.expiresAt,
      session.createdAt,
      session.lastSeenAt,
      serialize(metadata),
    );

    return clone(session);
  }

  /**
   * @param {string} tokenHash
   * @returns {{ session: any, actor: any } | null}
   */
  getSessionByTokenHash(tokenHash) {
    const row = this.db.prepare(`
      SELECT sessions.id, sessions.tenant_id, sessions.user_id, sessions.auth_method, sessions.expires_at, sessions.created_at, sessions.last_seen_at
      FROM sessions
      WHERE sessions.token_hash = ?
    `).get(tokenHash);

    if (!row) {
      return null;
    }

    const actor = this.getUserAccount(
      asString(row.user_id, 'sessions.user_id'),
      asString(row.tenant_id, 'sessions.tenant_id'),
    );

    if (!actor) {
      return null;
    }

    return {
      session: {
        schemaVersion: '1.0.0',
        id: asString(row.id, 'sessions.id'),
        tenantId: asString(row.tenant_id, 'sessions.tenant_id'),
        userId: asString(row.user_id, 'sessions.user_id'),
        authMethod: asString(row.auth_method, 'sessions.auth_method'),
        expiresAt: asString(row.expires_at, 'sessions.expires_at'),
        createdAt: asString(row.created_at, 'sessions.created_at'),
        lastSeenAt: asString(row.last_seen_at, 'sessions.last_seen_at'),
      },
      actor,
    };
  }

  /**
   * @param {string} sessionId
   * @param {string} lastSeenAt
   * @returns {void}
   */
  touchSession(sessionId, lastSeenAt) {
    this.db.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?').run(lastSeenAt, sessionId);
  }

  /**
   * @param {string} tokenHash
   * @returns {void}
   */
  deleteSessionByTokenHash(tokenHash) {
    this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
  }
}
