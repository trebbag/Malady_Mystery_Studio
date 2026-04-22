/**
 * @param {string} value
 * @returns {string}
 */
export function toSourceId(value) {
  return `src.${value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

const SOURCE_CATALOG = {
  [toSourceId('Approved endocrine emergency source')]: {
    sourceTier: 'tier-1',
    approvalStatus: 'approved',
    owner: 'clinical-governance',
    governanceNotes: ['Preferred for endocrine emergency stabilization and diagnosis claims.'],
  },
  [toSourceId('Approved endocrine review')]: {
    sourceTier: 'tier-2',
    approvalStatus: 'approved',
    owner: 'clinical-governance',
    governanceNotes: ['Useful for mechanistic explanation and teaching context.'],
  },
  [toSourceId('Approved hepatobiliary oncology source')]: {
    sourceTier: 'tier-1',
    approvalStatus: 'approved',
    owner: 'clinical-governance',
    governanceNotes: ['Preferred for stage-aware oncology treatment recommendations.'],
  },
  [toSourceId('Approved hepatology source')]: {
    sourceTier: 'tier-1',
    approvalStatus: 'approved',
    owner: 'clinical-governance',
    governanceNotes: ['Preferred baseline source for hepatology and liver tumor evaluation.'],
  },
  [toSourceId('Approved liver imaging reference')]: {
    sourceTier: 'tier-1',
    approvalStatus: 'approved',
    owner: 'clinical-governance',
    governanceNotes: ['Use for imaging behavior and lesion characterization claims.'],
  },
  [toSourceId('Approved neurology reference')]: {
    sourceTier: 'tier-1',
    approvalStatus: 'approved',
    owner: 'clinical-governance',
    governanceNotes: ['Preferred source for neurologic diagnostic framing.'],
  },
  [toSourceId('Approved neurology review')]: {
    sourceTier: 'tier-2',
    approvalStatus: 'approved',
    owner: 'clinical-governance',
    governanceNotes: ['Useful for explanatory narrative context.'],
  },
  [toSourceId('Approved neuromuscular source')]: {
    sourceTier: 'tier-1',
    approvalStatus: 'approved',
    owner: 'clinical-governance',
    governanceNotes: ['Preferred source for neuromuscular junction disorders.'],
  },
  [toSourceId('Approved oncology review')]: {
    sourceTier: 'tier-2',
    approvalStatus: 'approved',
    owner: 'clinical-governance',
    governanceNotes: ['Secondary oncology synthesis source.'],
  },
  [toSourceId('Approved pathology reference')]: {
    sourceTier: 'tier-2',
    approvalStatus: 'approved',
    owner: 'clinical-governance',
    governanceNotes: ['Use for pathology confirmation and histology language.'],
  },
  [toSourceId('Approved thrombosis guideline')]: {
    sourceTier: 'tier-1',
    approvalStatus: 'approved',
    owner: 'clinical-governance',
    governanceNotes: ['Preferred source for venous thromboembolism diagnosis and treatment decisions.'],
  },
  [toSourceId('Approved cardiopulmonary review')]: {
    sourceTier: 'tier-2',
    approvalStatus: 'approved',
    owner: 'clinical-governance',
    governanceNotes: ['Use for physiologic explanation of gas-exchange and right-heart effects.'],
  },
  [toSourceId('Approved pneumonia guideline')]: {
    sourceTier: 'tier-1',
    approvalStatus: 'approved',
    owner: 'clinical-governance',
    governanceNotes: ['Preferred source for pneumonia diagnosis and treatment.'],
  },
  [toSourceId('Approved pancreatitis guideline')]: {
    sourceTier: 'tier-1',
    approvalStatus: 'approved',
    owner: 'clinical-governance',
    governanceNotes: ['Preferred source for pancreatitis diagnosis, triage, and supportive care.'],
  },
  [toSourceId('Approved GI review')]: {
    sourceTier: 'tier-2',
    approvalStatus: 'approved',
    owner: 'clinical-governance',
    governanceNotes: ['Useful for mechanism teaching in gastrointestinal inflammation.'],
  },
  [toSourceId('Approved abdominal imaging review')]: {
    sourceTier: 'tier-2',
    approvalStatus: 'approved',
    owner: 'clinical-governance',
    governanceNotes: ['Use for abdominal imaging framing and complication detection.'],
  },
  [toSourceId('Approved pulmonary review')]: {
    sourceTier: 'tier-2',
    approvalStatus: 'approved',
    owner: 'clinical-governance',
    governanceNotes: ['Supplemental pulmonary teaching source.'],
  },
  [toSourceId('Approved radiology review')]: {
    sourceTier: 'tier-2',
    approvalStatus: 'approved',
    owner: 'clinical-governance',
    governanceNotes: ['Used for imaging-pathology correlation.'],
  },
};

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
 * @param {{ canonicalDiseaseName?: string, sourceLabel: string, sourceType: string, lastReviewedAt?: string, contradictionStatus?: string }} input
 * @returns {any}
 */
export function buildSourceRecord(input) {
  const sourceId = toSourceId(input.sourceLabel);
  const sourceCatalogEntry = SOURCE_CATALOG[sourceId] ?? {
    sourceTier: 'tier-3',
    approvalStatus: 'conditional',
    owner: 'clinical-governance',
    governanceNotes: ['Fallback source record generated from starter metadata; review before pilot use.'],
  };
  const freshnessScore = calculateFreshnessScore(input.lastReviewedAt);

  return {
    schemaVersion: '1.0.0',
    id: sourceId,
    canonicalDiseaseName: input.canonicalDiseaseName,
    sourceLabel: input.sourceLabel,
    sourceType: input.sourceType,
    sourceTier: sourceCatalogEntry.sourceTier,
    approvalStatus: sourceCatalogEntry.approvalStatus,
    freshnessScore,
    freshnessStatus: classifyFreshness(freshnessScore),
    contradictionStatus: input.contradictionStatus ?? 'none',
    owner: sourceCatalogEntry.owner,
    governanceNotes: sourceCatalogEntry.governanceNotes,
    lastReviewedAt: input.lastReviewedAt ?? new Date().toISOString(),
  };
}
