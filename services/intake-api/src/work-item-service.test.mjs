import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildReviewQueueView,
  buildWorkItem,
  escalateOverdueWorkItems,
  getDefaultSlaHours,
  isWorkItemOverdue,
} from './work-item-service.mjs';

function createFakeStore(seedArtifacts = {}) {
  const artifactsByType = new Map(Object.entries(seedArtifacts).map(([artifactType, records]) => [artifactType, [...records]]));

  return {
    /**
     * @param {string} artifactType
     * @returns {any[]}
     */
    listArtifactsByType(artifactType) {
      return structuredClone(artifactsByType.get(artifactType) ?? []);
    },
    /**
     * @param {string} artifactType
     * @param {string} artifactId
     * @param {any} artifact
     * @returns {void}
     */
    saveArtifact(artifactType, artifactId, artifact) {
      const current = artifactsByType.get(artifactType) ?? [];
      const next = current.filter((entry) => entry.id !== artifactId);
      next.push(structuredClone(artifact));
      artifactsByType.set(artifactType, next);
    },
  };
}

test('default SLA policy covers pilot queue work types', () => {
  assert.equal(getDefaultSlaHours('run-review', 'clinical-governance-blocked'), 4);
  assert.equal(getDefaultSlaHours('render-retry'), 8);
  assert.equal(getDefaultSlaHours('source-refresh'), 120);
  assert.equal(getDefaultSlaHours('ops-drill'), 240);
});

test('overdue work items escalate and can increase priority after 2x SLA', () => {
  const overdueWorkItem = buildWorkItem({
    tenantId: 'tenant.local',
    workflowRunId: 'run.local.001',
    workType: 'render-retry',
    queueName: 'render-execution',
    subjectType: 'render-job',
    subjectId: 'rjob.local.001',
    reason: 'default',
    priority: 'medium',
  });
  overdueWorkItem.dueAt = '2026-04-22T10:00:00Z';
  overdueWorkItem.createdAt = '2026-04-21T10:00:00Z';
  overdueWorkItem.updatedAt = '2026-04-21T10:00:00Z';

  const store = createFakeStore({
    'work-item': [overdueWorkItem],
  });

  assert.equal(isWorkItemOverdue(overdueWorkItem, '2026-04-23T10:00:00Z'), true);

  const escalated = escalateOverdueWorkItems(/** @type {any} */ (store), 'tenant.local', '2026-04-23T10:00:00Z');
  assert.equal(escalated.length, 1);
  assert.equal(escalated[0].status, 'escalated');
  assert.equal(escalated[0].priority, 'high');
});

test('review queue view summarizes queue state across runs', () => {
  const workItem = {
    schemaVersion: '1.0.0',
    id: 'wrk.local.001',
    tenantId: 'tenant.local',
    workflowRunId: 'run.local.001',
    workType: 'source-refresh',
    status: 'queued',
    priority: 'medium',
    queueName: 'review-queue',
    subjectType: 'source-record',
    subjectId: 'src.local.001',
    slaHours: 120,
    dueAt: '2026-04-25T10:00:00Z',
    createdAt: '2026-04-20T10:00:00Z',
    updatedAt: '2026-04-20T10:00:00Z',
    notes: ['Refresh source ownership and freshness.'],
  };
  const reviewThread = {
    schemaVersion: '1.0.0',
    id: 'thr.local.001',
    tenantId: 'tenant.local',
    workflowRunId: 'run.local.001',
    scopeType: 'run',
    title: 'Queue follow-up',
    status: 'open',
    createdBy: 'local-operator',
    createdAt: '2026-04-20T10:00:00Z',
    updatedAt: '2026-04-20T10:00:00Z',
  };
  const store = createFakeStore({
    'work-item': [workItem],
    'review-thread': [reviewThread],
  });

  const queueView = buildReviewQueueView(
    /** @type {any} */ (store),
    [{
      id: 'run.local.001',
      projectId: 'prj.local.001',
      tenantId: 'tenant.local',
      input: {
        diseaseName: 'Community-acquired pneumonia',
      },
    }],
    new Map([
      ['prj.local.001', { title: 'Community-acquired pneumonia starter project' }],
    ]),
    new URLSearchParams(),
  );

  assert.equal(queueView.items.length, 1);
  assert.equal(queueView.stats.sourceRefreshCount, 1);
  assert.equal(queueView.items[0].threadCount, 1);
});
