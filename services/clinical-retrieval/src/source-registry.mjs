/**
 * @param {number} value
 * @returns {number}
 */
function clampScore(value) {
  return Number(Math.max(0, Math.min(1, value)).toFixed(3));
}

/**
 * @param {string | undefined} lastReviewedAt
 * @param {number} cadenceDays
 * @returns {string}
 */
function calculateNextReviewDueAt(lastReviewedAt, cadenceDays) {
  const baseTimestamp = lastReviewedAt ? new Date(lastReviewedAt).getTime() : Date.now();
  return new Date(baseTimestamp + (cadenceDays * 24 * 60 * 60 * 1000)).toISOString();
}

/**
 * @param {any} sourceCatalogEntry
 * @returns {string}
 */
function defaultPrimaryOwnerRole(sourceCatalogEntry) {
  return sourceCatalogEntry.primaryOwnerRole
    ?? (sourceCatalogEntry.owner === 'clinical-governance' ? 'Clinical Reviewer' : 'Clinical Governance Owner');
}

/**
 * @param {any} sourceCatalogEntry
 * @returns {string}
 */
function defaultBackupOwnerRole(sourceCatalogEntry) {
  return sourceCatalogEntry.backupOwnerRole
    ?? (sourceCatalogEntry.owner === 'clinical-governance' ? 'Product Editor' : 'Clinical Governance Backup');
}

/**
 * @param {any} sourceCatalogEntry
 * @returns {number}
 */
function defaultRefreshCadenceDays(sourceCatalogEntry) {
  return Number.isInteger(sourceCatalogEntry.refreshCadenceDays)
    ? sourceCatalogEntry.refreshCadenceDays
    : (sourceCatalogEntry.sourceTier === 'tier-1' ? 180 : 365);
}

/**
 * @param {string | undefined} lastReviewedAt
 * @param {Date} [referenceDate]
 * @returns {number}
 */
export function calculateFreshnessScore(lastReviewedAt, referenceDate = new Date()) {
  if (!lastReviewedAt) {
    return 0.4;
  }

  const ageInDays = Math.max(0, (referenceDate.getTime() - new Date(lastReviewedAt).getTime()) / (1000 * 60 * 60 * 24));

  if (ageInDays <= 90) {
    return 0.98;
  }

  if (ageInDays <= 365) {
    return 0.84;
  }

  return 0.62;
}

/**
 * @param {number} freshnessScore
 * @returns {'current' | 'aging' | 'stale'}
 */
export function classifyFreshness(freshnessScore) {
  if (freshnessScore >= 0.9) {
    return 'current';
  }

  if (freshnessScore >= 0.75) {
    return 'aging';
  }

  return 'stale';
}

/**
 * @param {any} sourceCatalogEntry
 * @param {any | null | undefined} decision
 * @param {'none' | 'monitor' | 'blocking'} contradictionStatus
 * @returns {any}
 */
export function buildSourceRecord(sourceCatalogEntry, decision, contradictionStatus = 'none') {
  const reviewedAt = decision?.reviewedAt ?? decision?.occurredAt ?? sourceCatalogEntry.lastReviewedAt;
  const freshnessScore = calculateFreshnessScore(reviewedAt);
  const freshnessStatus = classifyFreshness(freshnessScore);
  const approvalStatus = decision?.decision === 'approved'
    || decision?.decision === 'conditional'
    || decision?.decision === 'suspended'
    ? decision.decision
    : sourceCatalogEntry.defaultApprovalStatus;
  const primaryOwnerRole = defaultPrimaryOwnerRole(sourceCatalogEntry);
  const backupOwnerRole = defaultBackupOwnerRole(sourceCatalogEntry);
  const refreshCadenceDays = defaultRefreshCadenceDays(sourceCatalogEntry);
  const nextReviewDueAt = sourceCatalogEntry.nextReviewDueAt ?? calculateNextReviewDueAt(reviewedAt, refreshCadenceDays);
  const governanceNotes = [...(sourceCatalogEntry.governanceNotes ?? [])];

  if (typeof decision?.reason === 'string' && decision.reason) {
    governanceNotes.push(decision.reason);
  }

  return {
    schemaVersion: '1.0.0',
    id: sourceCatalogEntry.id,
    canonicalDiseaseName: sourceCatalogEntry.canonicalDiseaseName,
    sourceLabel: sourceCatalogEntry.sourceLabel,
    sourceType: sourceCatalogEntry.sourceType,
    sourceTier: sourceCatalogEntry.sourceTier,
    ...(typeof sourceCatalogEntry.origin === 'string' ? { origin: sourceCatalogEntry.origin } : {}),
    ...(typeof sourceCatalogEntry.retrievedAt === 'string' ? { retrievedAt: sourceCatalogEntry.retrievedAt } : {}),
    ...(typeof sourceCatalogEntry.captureMethod === 'string' ? { captureMethod: sourceCatalogEntry.captureMethod } : {}),
    ...(typeof sourceCatalogEntry.reviewState === 'string' ? { reviewState: sourceCatalogEntry.reviewState } : {}),
    approvalStatus,
    freshnessScore: clampScore(freshnessScore),
    freshnessStatus,
    contradictionStatus,
    owner: sourceCatalogEntry.owner,
    primaryOwnerRole,
    backupOwnerRole,
    refreshCadenceDays,
    nextReviewDueAt,
    freshnessState: approvalStatus === 'suspended' || typeof sourceCatalogEntry.supersededBy === 'string'
      ? 'blocked'
      : freshnessStatus,
    governanceNotes,
    lastReviewedAt: reviewedAt,
    ...(typeof sourceCatalogEntry.supersededBy === 'string' ? { supersededBy: sourceCatalogEntry.supersededBy } : {}),
    ...(typeof sourceCatalogEntry.sourceUrl === 'string' ? { sourceUrl: sourceCatalogEntry.sourceUrl } : {}),
  };
}
