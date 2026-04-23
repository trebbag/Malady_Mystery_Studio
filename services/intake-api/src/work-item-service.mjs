import { createId } from '../../../packages/shared-config/src/ids.mjs';

/** @type {Readonly<Record<string, number>>} */
const DEFAULT_SLA_HOURS = Object.freeze({
  'run-review:clinical-governance-blocked': 4,
  'run-review:clinical-governance-review-required': 4,
  'run-review:export-blocker': 24,
  'render-retry:default': 8,
  'source-refresh:default': 120,
  'ops-drill:default': 240,
  'contradiction-resolution:default': 24,
});

/**
 * @template T
 * @param {T} value
 * @returns {T}
 */
function clone(value) {
  return structuredClone(value);
}

/**
 * @param {string} isoTimestamp
 * @param {number} hours
 * @returns {string}
 */
function addHours(isoTimestamp, hours) {
  return new Date(new Date(isoTimestamp).getTime() + (hours * 60 * 60 * 1000)).toISOString();
}

/**
 * @param {string} isoTimestamp
 * @param {number} fraction
 * @param {number} totalHours
 * @returns {string}
 */
function fractionOfSla(isoTimestamp, fraction, totalHours) {
  return addHours(isoTimestamp, totalHours * fraction);
}

/**
 * @param {any} workItem
 * @param {string} [referenceTimestamp]
 * @returns {boolean}
 */
export function isWorkItemOverdue(workItem, referenceTimestamp = new Date().toISOString()) {
  if (!workItem?.dueAt || workItem.status === 'completed' || workItem.status === 'cancelled') {
    return false;
  }

  return new Date(workItem.dueAt).getTime() < new Date(referenceTimestamp).getTime();
}

/**
 * @param {string} workType
 * @param {string} reason
 * @returns {number}
 */
export function getDefaultSlaHours(workType, reason = 'default') {
  return DEFAULT_SLA_HOURS[`${workType}:${reason}`] ?? DEFAULT_SLA_HOURS[`${workType}:default`] ?? 24;
}

/**
 * @param {{
 *   tenantId: string,
 *   workflowRunId?: string,
 *   workType: string,
 *   queueName: string,
 *   subjectType: string,
 *   subjectId: string,
 *   reason: string,
 *   priority?: string,
 *   assignedActorId?: string,
 *   assignedActorDisplayName?: string,
 *   assignedActorRoles?: string[],
 *   originType?: string,
 *   originId?: string,
 *   notes?: string[],
 *   metadata?: Record<string, unknown>,
 *   existingWorkItem?: any,
 * }} options
 * @returns {any}
 */
export function buildWorkItem(options) {
  const timestamp = new Date().toISOString();
  const existing = options.existingWorkItem ?? null;
  const slaHours = getDefaultSlaHours(options.workType, options.reason);
  const createdAt = existing?.createdAt ?? timestamp;

  return {
    schemaVersion: '1.0.0',
    id: existing?.id ?? createId('wrk'),
    tenantId: options.tenantId,
    workflowRunId: options.workflowRunId,
    workType: options.workType,
    status: existing?.status ?? 'queued',
    priority: options.priority ?? existing?.priority ?? 'medium',
    queueName: options.queueName,
    fallbackQueueName: existing?.fallbackQueueName ?? `${options.queueName}-fallback`,
    subjectType: options.subjectType,
    subjectId: options.subjectId,
    originType: options.originType,
    originId: options.originId,
    assignedActorId: options.assignedActorId ?? existing?.assignedActorId,
    assignedActorDisplayName: options.assignedActorDisplayName ?? existing?.assignedActorDisplayName,
    assignedActorRoles: options.assignedActorRoles ?? existing?.assignedActorRoles ?? [],
    slaHours,
    reminderAt: fractionOfSla(createdAt, 0.5, slaHours),
    dueAt: existing?.dueAt ?? addHours(createdAt, slaHours),
    escalatedAt: existing?.escalatedAt,
    completedAt: existing?.completedAt,
    notes: options.notes ?? existing?.notes ?? [],
    metadata: {
      ...(existing?.metadata ?? {}),
      ...(options.metadata ?? {}),
      reason: options.reason,
    },
    createdAt,
    updatedAt: timestamp,
  };
}

/**
 * @param {{ tenantId: string, workflowRunId: string, scopeType: string, scopeId?: string, title: string, actor: any, existingThread?: any | null }} options
 * @returns {any}
 */
export function buildReviewThread(options) {
  const timestamp = new Date().toISOString();
  const existing = options.existingThread ?? null;

  return {
    schemaVersion: '1.0.0',
    id: existing?.id ?? createId('thr'),
    tenantId: options.tenantId,
    workflowRunId: options.workflowRunId,
    scopeType: options.scopeType,
    scopeId: options.scopeId,
    title: options.title,
    status: existing?.status ?? 'open',
    participantIds: [...new Set([...(existing?.participantIds ?? []), options.actor.id])],
    createdBy: existing?.createdBy ?? options.actor.id,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
    resolvedAt: existing?.resolvedAt,
  };
}

/**
 * @param {{ tenantId: string, workflowRunId: string, threadId: string, body: string, actor: any, parentMessageId?: string, mentions?: string[], existingMessage?: any | null, resolutionNote?: string }} options
 * @returns {any}
 */
export function buildReviewMessage(options) {
  const timestamp = new Date().toISOString();
  const existing = options.existingMessage ?? null;

  return {
    schemaVersion: '1.0.0',
    id: existing?.id ?? createId('msg'),
    threadId: options.threadId,
    tenantId: options.tenantId,
    workflowRunId: options.workflowRunId,
    parentMessageId: options.parentMessageId ?? existing?.parentMessageId,
    authorId: options.actor.id,
    authorDisplayName: options.actor.displayName,
    body: options.body,
    mentions: options.mentions ?? existing?.mentions ?? [],
    status: options.resolutionNote ? 'resolved' : (existing ? 'edited' : 'posted'),
    resolutionNote: options.resolutionNote,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
    resolvedAt: options.resolutionNote ? timestamp : existing?.resolvedAt,
  };
}

/**
 * @param {import('./store.mjs').PlatformStore} store
 * @param {any} workflowRun
 * @returns {any[]}
 */
export function listWorkItemsForRun(store, workflowRun) {
  return store.listArtifactsByType('work-item', { tenantId: workflowRun.tenantId })
    .filter((workItem) => workItem.workflowRunId === workflowRun.id)
    .map((workItem) => clone(workItem));
}

/**
 * @param {import('./store.mjs').PlatformStore} store
 * @param {any} workflowRun
 * @returns {any[]}
 */
export function listReviewThreadsForRun(store, workflowRun) {
  return store.listArtifactsByType('review-thread', { tenantId: workflowRun.tenantId })
    .filter((thread) => thread.workflowRunId === workflowRun.id)
    .map((thread) => clone(thread));
}

/**
 * @param {import('./store.mjs').PlatformStore} store
 * @param {string} tenantId
 * @param {string} threadId
 * @returns {any[]}
 */
export function listMessagesForThread(store, tenantId, threadId) {
  return store.listArtifactsByType('review-message', { tenantId })
    .filter((message) => message.threadId === threadId)
    .sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)))
    .map((message) => clone(message));
}

/**
 * @param {import('./store.mjs').PlatformStore} store
 * @param {any[]} workflowRuns
 * @param {Map<string, any>} projectsById
 * @param {URLSearchParams} searchParams
 * @returns {any}
 */
export function buildReviewQueueView(store, workflowRuns, projectsById, searchParams) {
  const filters = {
    workType: searchParams.get('workType') ?? '',
    status: searchParams.get('status') ?? '',
    priority: searchParams.get('priority') ?? '',
    queueName: searchParams.get('queueName') ?? '',
    assignee: searchParams.get('assignee') ?? '',
  };
  const runById = new Map(workflowRuns.map((workflowRun) => [workflowRun.id, workflowRun]));
  const allWorkItems = store.listArtifactsByType('work-item', { tenantId: workflowRuns[0]?.tenantId ?? 'tenant.local' });
  const threads = store.listArtifactsByType('review-thread', { tenantId: workflowRuns[0]?.tenantId ?? 'tenant.local' });
  const items = allWorkItems
    .filter((workItem) => {
      if (filters.workType && workItem.workType !== filters.workType) {
        return false;
      }

      if (filters.status && workItem.status !== filters.status) {
        return false;
      }

      if (filters.priority && workItem.priority !== filters.priority) {
        return false;
      }

      if (filters.queueName && workItem.queueName !== filters.queueName) {
        return false;
      }

      if (filters.assignee) {
        const assignee = String(workItem.assignedActorDisplayName ?? '').toLowerCase();

        if (!assignee.includes(filters.assignee.toLowerCase())) {
          return false;
        }
      }

      return true;
    })
    .sort((left, right) => String(left.dueAt).localeCompare(String(right.dueAt)))
    .map((workItem) => {
      const workflowRun = workItem.workflowRunId ? runById.get(workItem.workflowRunId) : null;
      const project = workflowRun ? projectsById.get(workflowRun.projectId) : null;

      return {
        workItemId: workItem.id,
        workflowRunId: workflowRun?.id ?? '',
        projectTitle: project?.title ?? 'Unlinked work item',
        diseaseName: workflowRun?.input?.diseaseName ?? 'Unlinked work item',
        workType: workItem.workType,
        status: workItem.status,
        priority: workItem.priority,
        queueName: workItem.queueName,
        subjectType: workItem.subjectType,
        subjectId: workItem.subjectId,
        assignedActorDisplayName: workItem.assignedActorDisplayName,
        dueAt: workItem.dueAt,
        reminderAt: workItem.reminderAt,
        isOverdue: isWorkItemOverdue(workItem),
        threadCount: threads.filter((thread) => thread.workflowRunId === workflowRun?.id).length,
        notes: workItem.notes ?? [],
      };
    });

  return {
    schemaVersion: '1.0.0',
    filters,
    stats: {
      visibleItemCount: items.length,
      overdueItemCount: items.filter((item) => item.isOverdue).length,
      escalatedItemCount: items.filter((item) => item.status === 'escalated').length,
      renderRetryCount: items.filter((item) => item.workType === 'render-retry').length,
      sourceRefreshCount: items.filter((item) => item.workType === 'source-refresh').length,
    },
    items,
  };
}

/**
 * @param {import('./store.mjs').PlatformStore} store
 * @param {string} tenantId
 * @param {string} [referenceTimestamp]
 * @returns {any[]}
 */
export function escalateOverdueWorkItems(store, tenantId, referenceTimestamp = new Date().toISOString()) {
  const workItems = store.listArtifactsByType('work-item', { tenantId });
  /** @type {any[]} */
  const updated = [];

  for (const workItem of workItems) {
    if (!isWorkItemOverdue(workItem, referenceTimestamp) || workItem.status === 'completed' || workItem.status === 'cancelled') {
      continue;
    }

    const dueAt = new Date(workItem.dueAt).getTime();
    const overdueMs = new Date(referenceTimestamp).getTime() - dueAt;
    const twiceSlaMs = workItem.slaHours * 2 * 60 * 60 * 1000;
    const nextPriority = workItem.priority === 'medium'
      ? 'high'
      : (workItem.priority === 'high' ? 'critical' : workItem.priority);
    const nextWorkItem = {
      ...clone(workItem),
      status: 'escalated',
      priority: overdueMs >= twiceSlaMs ? nextPriority : workItem.priority,
      escalatedAt: referenceTimestamp,
      updatedAt: referenceTimestamp,
    };

    store.saveArtifact('work-item', nextWorkItem.id, nextWorkItem, {
      tenantId,
    });
    updated.push(nextWorkItem);
  }

  return updated;
}
