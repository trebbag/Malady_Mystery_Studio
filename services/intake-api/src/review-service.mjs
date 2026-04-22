/**
 * @template T
 * @param {T} value
 * @returns {T}
 */
function clone(value) {
  return structuredClone(value);
}

/**
 * @param {any} comment
 * @returns {boolean}
 */
export function isOpenReviewComment(comment) {
  return comment?.status === 'open';
}

/**
 * @param {any} assignment
 * @returns {boolean}
 */
export function isActiveReviewAssignment(assignment) {
  return assignment?.status === 'queued' || assignment?.status === 'in-progress';
}

/**
 * @param {any} store
 * @param {any} workflowRun
 * @returns {any[]}
 */
export function listReviewCommentsForRun(store, workflowRun) {
  return store
    .listArtifactsByType('review-comment', { tenantId: workflowRun.tenantId })
    .filter((/** @type {any} */ comment) => comment.workflowRunId === workflowRun.id)
    .sort((/** @type {any} */ left, /** @type {any} */ right) => right.updatedAt.localeCompare(left.updatedAt))
    .map((/** @type {any} */ comment) => clone(comment));
}

/**
 * @param {any} store
 * @param {any} workflowRun
 * @returns {any[]}
 */
export function listReviewAssignmentsForRun(store, workflowRun) {
  return store
    .listArtifactsByType('review-assignment', { tenantId: workflowRun.tenantId })
    .filter((/** @type {any} */ assignment) => assignment.workflowRunId === workflowRun.id)
    .sort((/** @type {any} */ left, /** @type {any} */ right) => right.updatedAt.localeCompare(left.updatedAt))
    .map((/** @type {any} */ assignment) => clone(assignment));
}

/**
 * @param {any[]} assignments
 * @returns {string[]}
 */
export function summarizeAssignmentDisplayNames(assignments) {
  return [...new Set(
    assignments
      .filter((assignment) => isActiveReviewAssignment(assignment))
      .map((assignment) => assignment.assigneeDisplayName)
      .filter((value) => typeof value === 'string' && value.trim().length > 0),
  )];
}

/**
 * @param {any[]} assignments
 * @param {string} assigneeFilter
 * @returns {boolean}
 */
export function matchesAssignmentFilter(assignments, assigneeFilter) {
  const normalizedFilter = assigneeFilter.trim().toLowerCase();

  if (!normalizedFilter) {
    return true;
  }

  return assignments.some((assignment) => (
    typeof assignment.assigneeDisplayName === 'string' && assignment.assigneeDisplayName.toLowerCase().includes(normalizedFilter)
  ) || (
    typeof assignment.assigneeId === 'string' && assignment.assigneeId.toLowerCase().includes(normalizedFilter)
  ) || (
    typeof assignment.reviewRole === 'string' && assignment.reviewRole.toLowerCase().includes(normalizedFilter)
  ));
}

/**
 * @param {any[]} comments
 * @returns {number}
 */
export function countOpenReviewComments(comments) {
  return comments.filter((comment) => isOpenReviewComment(comment)).length;
}

/**
 * @param {string} basePath
 * @param {string | number} segment
 * @returns {string}
 */
function appendPathSegment(basePath, segment) {
  if (typeof segment === 'number') {
    return `${basePath}[${segment}]`;
  }

  return basePath ? `${basePath}.${segment}` : segment;
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function normalizeScalar(value) {
  return value === undefined ? null : value;
}

/**
 * @param {unknown} before
 * @param {unknown} after
 * @param {string} [path]
 * @returns {Array<{ path: string, changeType: 'added' | 'removed' | 'changed', before?: unknown, after?: unknown }>}
 */
export function diffJsonValues(before, after, path = '') {
  if (Array.isArray(before) && Array.isArray(after)) {
    const maxLength = Math.max(before.length, after.length);
    /** @type {Array<{ path: string, changeType: 'added' | 'removed' | 'changed', before?: unknown, after?: unknown }>} */
    const changes = [];

    for (let index = 0; index < maxLength; index += 1) {
      const nextPath = appendPathSegment(path, index);

      if (index >= before.length) {
        changes.push({
          path: nextPath,
          changeType: 'added',
          after: clone(after[index]),
        });
        continue;
      }

      if (index >= after.length) {
        changes.push({
          path: nextPath,
          changeType: 'removed',
          before: clone(before[index]),
        });
        continue;
      }

      changes.push(...diffJsonValues(before[index], after[index], nextPath));
    }

    return changes;
  }

  if (isRecord(before) && isRecord(after)) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
    /** @type {Array<{ path: string, changeType: 'added' | 'removed' | 'changed', before?: unknown, after?: unknown }>} */
    const changes = [];

    for (const key of keys) {
      const nextPath = appendPathSegment(path, key);

      if (!(key in before)) {
        changes.push({
          path: nextPath,
          changeType: 'added',
          after: clone(after[key]),
        });
        continue;
      }

      if (!(key in after)) {
        changes.push({
          path: nextPath,
          changeType: 'removed',
          before: clone(before[key]),
        });
        continue;
      }

      changes.push(...diffJsonValues(before[key], after[key], nextPath));
    }

    return changes;
  }

  if (Object.is(before, after)) {
    return [];
  }

  return [{
    path: path || '$',
    changeType: 'changed',
    before: clone(normalizeScalar(before)),
    after: clone(normalizeScalar(after)),
  }];
}

/**
 * @param {Array<{ changeType: 'added' | 'removed' | 'changed' }>} changes
 * @returns {{ changeCount: number, addedCount: number, removedCount: number, changedCount: number }}
 */
export function summarizeJsonDiff(changes) {
  return {
    changeCount: changes.length,
    addedCount: changes.filter((change) => change.changeType === 'added').length,
    removedCount: changes.filter((change) => change.changeType === 'removed').length,
    changedCount: changes.filter((change) => change.changeType === 'changed').length,
  };
}
