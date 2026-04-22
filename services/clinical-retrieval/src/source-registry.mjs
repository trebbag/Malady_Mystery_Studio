/**
 * @param {number} value
 * @returns {number}
 */
function clampScore(value) {
  return Number(Math.max(0, Math.min(1, value)).toFixed(3));
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
  const approvalStatus = decision?.decision === 'approved'
    || decision?.decision === 'conditional'
    || decision?.decision === 'suspended'
    ? decision.decision
    : sourceCatalogEntry.defaultApprovalStatus;
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
    approvalStatus,
    freshnessScore: clampScore(freshnessScore),
    freshnessStatus: classifyFreshness(freshnessScore),
    contradictionStatus,
    owner: sourceCatalogEntry.owner,
    governanceNotes,
    lastReviewedAt: reviewedAt,
    ...(typeof sourceCatalogEntry.sourceUrl === 'string' ? { sourceUrl: sourceCatalogEntry.sourceUrl } : {}),
  };
}
