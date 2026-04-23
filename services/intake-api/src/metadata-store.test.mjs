import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createMetadataStore } from './metadata-store.mjs';

/**
 * @returns {Promise<{ rootDir: string, dbFilePath: string, objectStoreDir: string, cleanup: () => Promise<void> }>}
 */
async function createSandbox() {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'mms-metadata-store-'));

  return {
    rootDir,
    dbFilePath: path.join(rootDir, 'platform.sqlite'),
    objectStoreDir: path.join(rootDir, 'object-store'),
    cleanup: async () => {
      await rm(rootDir, { recursive: true, force: true });
    },
  };
}

class FakePostgresPool {
  /**
   * @param {{ tables?: Record<string, any[]>, workflowRunCount?: number }} [options]
   */
  constructor(options = {}) {
    this.tables = new Map(
      Object.entries(options.tables ?? {}).map(([tableName, rows]) => [tableName, rows.map((row) => structuredClone(row))]),
    );
    this.schemaMigrationIds = new Set();
    this.workflowRunCount = options.workflowRunCount ?? (this.tables.get('workflow_runs')?.length ?? 0);
  }

  /**
   * @param {string} sql
   * @param {unknown[]} [values]
   * @returns {Promise<{ rows: any[] }>}
   */
  async query(sql, values = []) {
    const normalizedSql = sql.trim().replace(/\s+/g, ' ');

    if (normalizedSql.startsWith('CREATE TABLE IF NOT EXISTS schema_migrations')) {
      return { rows: [] };
    }

    if (normalizedSql.startsWith('SELECT id FROM schema_migrations')) {
      return {
        rows: [...this.schemaMigrationIds].sort().map((id) => ({ id })),
      };
    }

    if (normalizedSql.startsWith('INSERT INTO schema_migrations')) {
      this.schemaMigrationIds.add(String(values[0] ?? ''));
      return { rows: [] };
    }

    if (normalizedSql.startsWith('SELECT COUNT(*)::int AS count FROM workflow_runs')) {
      return {
        rows: [{ count: this.workflowRunCount }],
      };
    }

    if (normalizedSql.startsWith('CREATE TABLE IF NOT EXISTS')) {
      return { rows: [] };
    }

    if (normalizedSql.startsWith('DELETE FROM sessions WHERE token_hash =')) {
      const rows = this.tables.get('sessions') ?? [];
      this.tables.set('sessions', rows.filter((row) => row.token_hash !== values[0]));
      this.workflowRunCount = this.tables.get('workflow_runs')?.length ?? this.workflowRunCount;
      return { rows: [] };
    }

    const selectMatch = normalizedSql.match(/^SELECT (.+) FROM "([^"]+)"$/u);

    if (selectMatch) {
      const [, columnList, tableName] = selectMatch;
      const columns = columnList
        .split(',')
        .map((column) => column.trim().replaceAll('"', ''));
      const rows = this.tables.get(tableName) ?? [];

      return {
        rows: rows.map((row) => Object.fromEntries(columns.map((column) => [column, row[column] ?? null]))),
      };
    }

    const insertMatch = normalizedSql.match(/^INSERT INTO "([^"]+)" \((.+)\) VALUES/u);

    if (insertMatch) {
      const [, tableName, columnList] = insertMatch;
      const columns = columnList
        .split(',')
        .map((column) => column.trim().replaceAll('"', ''));
      const row = Object.fromEntries(columns.map((column, index) => [column, values[index] ?? null]));
      const rows = this.tables.get(tableName) ?? [];
      const key = tableName === 'artifacts'
        ? `${row.artifact_type}:${row.artifact_id}`
        : tableName === 'documents'
          ? `${row.document_type}:${row.document_id}`
          : tableName === 'memberships'
            ? `${row.tenant_id}:${row.user_id}`
            : String(row.id ?? row.retention_class ?? '');
      const existingIndex = rows.findIndex((candidate) => {
        if (tableName === 'artifacts') {
          return candidate.artifact_type === row.artifact_type && candidate.artifact_id === row.artifact_id;
        }

        if (tableName === 'documents') {
          return candidate.document_type === row.document_type && candidate.document_id === row.document_id;
        }

        if (tableName === 'memberships') {
          return candidate.tenant_id === row.tenant_id && candidate.user_id === row.user_id;
        }

        return String(candidate.id ?? candidate.retention_class ?? '') === key;
      });

      if (existingIndex >= 0) {
        rows[existingIndex] = row;
      } else {
        rows.push(row);
      }

      this.tables.set(tableName, rows);
      this.workflowRunCount = this.tables.get('workflow_runs')?.length ?? this.workflowRunCount;
      return { rows: [] };
    }

    throw new Error(`Unsupported fake postgres query: ${normalizedSql}`);
  }
}

test('postgres mirrored metadata store accepts writes without failing fast', async () => {
  const sandbox = await createSandbox();

  try {
    const postgresPool = new FakePostgresPool();
    const store = await createMetadataStore({
      metadataStoreKind: 'postgres',
      rootDir: '/Users/gregorygabbert/Documents/GitHub/MaladyMysteryStudio',
      dbFilePath: sandbox.dbFilePath,
      objectStoreDir: sandbox.objectStoreDir,
      postgresPool,
    });

    store.saveProject({
      id: 'proj.demo.001',
      tenantId: 'tenant.local',
      title: 'Managed metadata project',
      status: 'draft',
      createdAt: '2026-04-23T12:00:00Z',
      updatedAt: '2026-04-23T12:00:00Z',
    });
    store.saveWorkflowRun({
      id: 'run.demo.001',
      tenantId: 'tenant.local',
      projectId: 'proj.demo.001',
      state: 'review',
      currentStage: 'render-prep',
      createdAt: '2026-04-23T12:00:00Z',
      updatedAt: '2026-04-23T12:00:00Z',
      input: {
        diseaseName: 'Unseen disease',
      },
      stages: [],
      artifacts: [],
      approvals: [],
      requiredApprovalRoles: [],
    });

    await /** @type {any} */ (store).flushMirrors();

    const mirroredProjects = postgresPool.tables.get('projects') ?? [];
    const mirroredRuns = postgresPool.tables.get('workflow_runs') ?? [];

    assert.equal(mirroredProjects.length, 1);
    assert.equal(mirroredProjects[0].title, 'Managed metadata project');
    assert.equal(mirroredRuns.length, 1);
    assert.equal(mirroredRuns[0].id, 'run.demo.001');

    await /** @type {any} */ (store).closeAsync();
  } finally {
    await sandbox.cleanup();
  }
});

test('postgres mirrored metadata store hydrates local cache from existing managed rows', async () => {
  const sandbox = await createSandbox();

  try {
    const postgresPool = new FakePostgresPool({
      workflowRunCount: 1,
      tables: {
        retention_policies: [{
          retention_class: 'approved-artifact',
          description: 'Approved workflow artifacts and exportable deliverables.',
          default_days: 365,
        }],
        projects: [{
          id: 'proj.demo.002',
          tenant_id: 'tenant.local',
          title: 'Hydrated project',
          status: 'draft',
          active_workflow_run_id: null,
          created_at: '2026-04-23T12:00:00Z',
          updated_at: '2026-04-23T12:00:00Z',
          version: 1,
          payload_json: JSON.stringify({
            id: 'proj.demo.002',
            tenantId: 'tenant.local',
            title: 'Hydrated project',
            status: 'draft',
            createdAt: '2026-04-23T12:00:00Z',
            updatedAt: '2026-04-23T12:00:00Z',
          }),
        }],
        workflow_runs: [{
          id: 'run.demo.002',
          tenant_id: 'tenant.local',
          project_id: 'proj.demo.002',
          state: 'review',
          current_stage: 'render-prep',
          created_at: '2026-04-23T12:00:00Z',
          updated_at: '2026-04-23T12:05:00Z',
          version: 1,
          payload_json: JSON.stringify({
            id: 'run.demo.002',
            tenantId: 'tenant.local',
            projectId: 'proj.demo.002',
            state: 'review',
            currentStage: 'render-prep',
            createdAt: '2026-04-23T12:00:00Z',
            updatedAt: '2026-04-23T12:05:00Z',
            input: {
              diseaseName: 'Hydrated disease',
            },
            stages: [],
            artifacts: [],
            approvals: [],
            requiredApprovalRoles: [],
          }),
        }],
      },
    });
    const store = await createMetadataStore({
      metadataStoreKind: 'postgres',
      rootDir: '/Users/gregorygabbert/Documents/GitHub/MaladyMysteryStudio',
      dbFilePath: sandbox.dbFilePath,
      objectStoreDir: sandbox.objectStoreDir,
      postgresPool,
    });

    const hydratedProject = store.getProject('proj.demo.002');
    const hydratedRun = store.getWorkflowRun('run.demo.002');

    assert.equal(hydratedProject?.title, 'Hydrated project');
    assert.equal(hydratedRun?.input?.diseaseName, 'Hydrated disease');

    await /** @type {any} */ (store).closeAsync();
  } finally {
    await sandbox.cleanup();
  }
});
