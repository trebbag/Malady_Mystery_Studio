import { createId } from '../../../packages/shared-config/src/ids.mjs';

/** @type {Readonly<Record<string, number>>} */
const DEFAULT_SLA_HOURS = Object.freeze({
  'run-review:clinical-governance-blocked': 4,
  'run-review:clinical-governance-review-required': 4,
  'run-review:render-guide-review-required': 4,
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
 * @param {number[]} values
 * @returns {number}
 */
function median(values) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return Number(((sorted[middle - 1] + sorted[middle]) / 2).toFixed(2));
  }

  return Number(sorted[middle].toFixed(2));
}

/**
 * @param {any[]} rows
 * @param {(row: any) => string} getKey
 * @param {string} labelName
 * @returns {Array<Record<string, string | number>>}
 */
function countRows(rows, getKey, labelName) {
  return Object.entries(rows.reduce((totals, row) => {
    const key = getKey(row) || 'unknown';
    totals[key] = (totals[key] ?? 0) + 1;
    return totals;
  }, /** @type {Record<string, number>} */ ({}))).map(([key, count]) => ({
    [labelName]: key,
    count,
  }));
}

/**
 * @param {any[]} workItems
 * @param {string} referenceTimestamp
 * @returns {Array<{ bucket: string, count: number }>}
 */
function buildOverdueAgingBuckets(workItems, referenceTimestamp) {
  const buckets = [
    { bucket: 'not-overdue', count: 0 },
    { bucket: '0-24h-overdue', count: 0 },
    { bucket: '24-48h-overdue', count: 0 },
    { bucket: '48-120h-overdue', count: 0 },
    { bucket: '120h-plus-overdue', count: 0 },
  ];

  for (const workItem of workItems) {
    if (!isWorkItemOverdue(workItem, referenceTimestamp)) {
      buckets[0].count += 1;
      continue;
    }

    const overdueHours = Math.max(0, (new Date(referenceTimestamp).getTime() - new Date(workItem.dueAt).getTime()) / (1000 * 60 * 60));

    if (overdueHours <= 24) {
      buckets[1].count += 1;
    } else if (overdueHours <= 48) {
      buckets[2].count += 1;
    } else if (overdueHours <= 120) {
      buckets[3].count += 1;
    } else {
      buckets[4].count += 1;
    }
  }

  return buckets;
}

/**
 * @param {any[]} workItems
 * @param {string} referenceTimestamp
 * @returns {Array<{ bucket: string, count: number }>}
 */
function buildSlaBuckets(workItems, referenceTimestamp) {
  const buckets = [
    { bucket: 'completed', count: 0 },
    { bucket: 'on-track', count: 0 },
    { bucket: 'reminder-due', count: 0 },
    { bucket: 'overdue', count: 0 },
    { bucket: 'escalated', count: 0 },
  ];

  for (const workItem of workItems) {
    if (workItem.status === 'completed') {
      buckets[0].count += 1;
    } else if (workItem.status === 'escalated') {
      buckets[4].count += 1;
    } else if (isWorkItemOverdue(workItem, referenceTimestamp)) {
      buckets[3].count += 1;
    } else if (isWorkItemReminderDue(workItem, referenceTimestamp)) {
      buckets[2].count += 1;
    } else {
      buckets[1].count += 1;
    }
  }

  return buckets;
}

/**
 * @param {any[]} workItems
 * @returns {Array<{ canonicalDiseaseName: string, ownerRole: string, openCount: number, overdueCount: number }>}
 */
function buildSourceRefreshBurden(workItems) {
  const sourceRefreshItems = workItems.filter((workItem) => workItem.workType === 'source-refresh');
  /** @type {Record<string, { canonicalDiseaseName: string, ownerRole: string, openCount: number, overdueCount: number }>} */
  const burdenByKey = {};

  for (const workItem of sourceRefreshItems) {
    const canonicalDiseaseName = String(workItem.metadata?.canonicalDiseaseName ?? 'Unknown disease');
    const ownerRole = workItem.assignedActorRoles?.[0] ?? workItem.assignedActorDisplayName ?? 'Unassigned';
    const key = `${canonicalDiseaseName}::${ownerRole}`;
    const row = burdenByKey[key] ?? {
      canonicalDiseaseName,
      ownerRole,
      openCount: 0,
      overdueCount: 0,
    };

    if (workItem.status !== 'completed' && workItem.status !== 'cancelled') {
      row.openCount += 1;
    }

    if (isWorkItemOverdue(workItem)) {
      row.overdueCount += 1;
    }

    burdenByKey[key] = row;
  }

  return Object.values(burdenByKey)
    .sort((left, right) => right.openCount - left.openCount || left.canonicalDiseaseName.localeCompare(right.canonicalDiseaseName));
}

/**
 * @param {any[]} threads
 * @returns {{ openThreadCount: number, resolvedThreadCount: number, medianResolutionHours: number }}
 */
function buildThreadResolutionSummary(threads) {
  const resolvedDurations = threads
    .filter((thread) => thread.status === 'resolved' && thread.createdAt && thread.resolvedAt)
    .map((thread) => Math.max(0, (new Date(thread.resolvedAt).getTime() - new Date(thread.createdAt).getTime()) / (1000 * 60 * 60)));

  return {
    openThreadCount: threads.filter((thread) => thread.status === 'open').length,
    resolvedThreadCount: threads.filter((thread) => thread.status === 'resolved').length,
    medianResolutionHours: median(resolvedDurations),
  };
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
 * @param {any} workItem
 * @param {string} [referenceTimestamp]
 * @returns {boolean}
 */
export function isWorkItemReminderDue(workItem, referenceTimestamp = new Date().toISOString()) {
  if (
    !workItem?.reminderAt
    || workItem.status === 'completed'
    || workItem.status === 'cancelled'
    || isWorkItemOverdue(workItem, referenceTimestamp)
  ) {
    return false;
  }

  return new Date(workItem.reminderAt).getTime() <= new Date(referenceTimestamp).getTime();
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
 * @param {{ tenantId: string, workflowRunId: string, threadId: string, body: string, actor: any, parentMessageId?: string, mentions?: string[], mentionedActorIds?: string[], existingMessage?: any | null, resolutionNote?: string }} options
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
    mentionedActorIds: options.mentionedActorIds ?? existing?.mentionedActorIds ?? [],
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
  const notifications = store.listArtifactsByType('notification', { tenantId: workflowRuns[0]?.tenantId ?? 'tenant.local' });
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
      const linkedThreads = threads.filter((thread) => (
        thread.workflowRunId === workflowRun?.id
        && (
          thread.scopeType === 'run'
          || thread.scopeId === workItem.subjectId
          || thread.scopeId === `${workItem.subjectType}:${workItem.subjectId}`
        )
      ));
      const linkedNotifications = notifications.filter((notification) => (
        notification.workItemId === workItem.id
        || (notification.workflowRunId && notification.workflowRunId === workflowRun?.id && notification.subjectId === workItem.subjectId)
      ));
      const latestThread = linkedThreads
        .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
        .at(0);

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
        reminderDue: isWorkItemReminderDue(workItem),
        escalationTargetQueue: workItem.fallbackQueueName,
        threadCount: linkedThreads.length,
        latestThreadStatus: latestThread?.status,
        notificationCount: linkedNotifications.length,
        unreadNotificationCount: linkedNotifications.filter((notification) => notification.status === 'unread').length,
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
      dueSoonItemCount: items.filter((item) => item.reminderDue).length,
      fallbackQueueItemCount: items.filter((item) => item.status === 'escalated' && item.escalationTargetQueue).length,
      unreadNotificationCount: items.reduce((total, item) => total + (item.unreadNotificationCount ?? 0), 0),
    },
    items,
  };
}

/**
 * @param {import('./store.mjs').PlatformStore} store
 * @param {any[]} workflowRuns
 * @returns {any}
 */
export function buildReviewQueueAnalyticsView(store, workflowRuns) {
  const referenceTimestamp = new Date().toISOString();
  const tenantId = workflowRuns[0]?.tenantId ?? 'tenant.local';
  const allWorkItems = store.listArtifactsByType('work-item', { tenantId });
  const notifications = store.listArtifactsByType('notification', { tenantId });
  const threads = store.listArtifactsByType('review-thread', { tenantId });
  const ageHours = allWorkItems.map((workItem) => (
    Math.max(0, (Date.now() - new Date(workItem.createdAt).getTime()) / (1000 * 60 * 60))
  ));
  const overdueItemCount = allWorkItems.filter((workItem) => isWorkItemOverdue(workItem)).length;
  const escalatedItemCount = allWorkItems.filter((workItem) => workItem.status === 'escalated').length;
  const dueSoonItemCount = allWorkItems.filter((workItem) => isWorkItemReminderDue(workItem)).length;
  const completedItemCount = allWorkItems.filter((workItem) => workItem.status === 'completed').length;
  const fallbackQueueItemCount = allWorkItems.filter((workItem) => workItem.status === 'escalated' && workItem.fallbackQueueName).length;
  const unreadNotificationCount = notifications.filter((notification) => notification.status === 'unread').length;
  const unresolvedMentionCount = notifications.filter((notification) => (
    notification.status === 'unread' && notification.notificationType === 'mention'
  )).length;
  const sourceRefreshOpenCount = allWorkItems.filter((workItem) => (
    workItem.workType === 'source-refresh' && workItem.status !== 'completed' && workItem.status !== 'cancelled'
  )).length;
  const renderRetryOpenCount = allWorkItems.filter((workItem) => (
    workItem.workType === 'render-retry' && workItem.status !== 'completed' && workItem.status !== 'cancelled'
  )).length;
  const opsDrillOpenCount = allWorkItems.filter((workItem) => (
    workItem.workType === 'ops-drill' && workItem.status !== 'completed' && workItem.status !== 'cancelled'
  )).length;
  const threadResolution = buildThreadResolutionSummary(threads);
  const countsByWorkType = countRows(allWorkItems, (workItem) => workItem.workType, 'workType');
  const countsByStatus = countRows(allWorkItems, (workItem) => workItem.status, 'status');
  const countsByPriority = countRows(allWorkItems, (workItem) => workItem.priority, 'priority');
  const assigneeLoad = countRows(allWorkItems, (workItem) => String(workItem.assignedActorDisplayName ?? 'Unassigned'), 'assignee');
  const runBlockersByStage = Object.entries(workflowRuns.reduce((totals, workflowRun) => {
    if (workflowRun.pauseReason) {
      totals[workflowRun.currentStage] = (totals[workflowRun.currentStage] ?? 0) + 1;
    }
    return totals;
  }, /** @type {Record<string, number>} */ ({}))).map(([stage, count]) => ({ stage, count }));

  return {
    schemaVersion: '1.0.0',
    summary: {
      totalItemCount: allWorkItems.length,
      overdueItemCount,
      escalatedItemCount,
      overdueRate: allWorkItems.length > 0 ? Number((overdueItemCount / allWorkItems.length).toFixed(3)) : 0,
      escalationRate: allWorkItems.length > 0 ? Number((escalatedItemCount / allWorkItems.length).toFixed(3)) : 0,
      medianAgeHours: median(ageHours),
      dueSoonItemCount,
      completedItemCount,
      fallbackQueueItemCount,
      unreadNotificationCount,
      unresolvedMentionCount,
      sourceRefreshOpenCount,
      renderRetryOpenCount,
      opsDrillOpenCount,
      medianThreadResolutionHours: threadResolution.medianResolutionHours,
    },
    countsByWorkType,
    countsByStatus,
    countsByPriority,
    assigneeLoad,
    runBlockersByStage,
    overdueAgingBuckets: buildOverdueAgingBuckets(allWorkItems, referenceTimestamp),
    slaBuckets: buildSlaBuckets(allWorkItems, referenceTimestamp),
    sourceRefreshBurden: buildSourceRefreshBurden(allWorkItems),
    threadResolution,
  };
}

/**
 * @param {{
 *   tenantId: string,
 *   analytics: any,
 *   actor: any,
 *   snapshotLabel?: string,
 * }} options
 * @returns {any}
 */
export function buildReviewQueueAnalyticsSnapshot(options) {
  const timestamp = new Date().toISOString();

  return {
    schemaVersion: '1.0.0',
    id: createId('qas'),
    tenantId: options.tenantId,
    snapshotLabel: options.snapshotLabel ?? `Local queue snapshot ${timestamp}`,
    analytics: clone(options.analytics),
    createdBy: options.actor.id,
    createdAt: timestamp,
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
