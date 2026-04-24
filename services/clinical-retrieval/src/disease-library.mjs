import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { findRepoRoot } from '../../../packages/shared-config/src/repo-paths.mjs';

const KNOWLEDGE_PACK_DIRECTORY = path.join('services', 'clinical-retrieval', 'knowledge-packs');

/** @type {Map<string, Record<string, any>>} */
const libraryCache = new Map();
/** @type {Map<string, Record<string, any[]>>} */
const ambiguousInputCache = new Map();

/**
 * @param {string} value
 * @returns {string}
 */
function normalizeKey(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * @param {string} value
 * @returns {string}
 */
function compactId(value) {
  return normalizeKey(value).replace(/-/g, '.');
}

/**
 * @param {string} slug
 * @param {string} suffix
 * @returns {string}
 */
function claimId(slug, suffix) {
  return `clm.${slug}.${suffix}`;
}

/**
 * @param {string} slug
 * @param {string} suffix
 * @returns {string}
 */
function sourceId(slug, suffix) {
  return `src.${slug}.${suffix}`;
}

/**
 * @param {any} entry
 * @param {number} index
 * @returns {any}
 */
function expandCompactSource(entry, index) {
  return {
    id: entry.id,
    sourceLabel: entry.label,
    sourceType: entry.type ?? 'reference',
    sourceTier: entry.tier ?? 'tier-1',
    origin: 'seeded',
    reviewState: 'approved',
    defaultApprovalStatus: 'approved',
    owner: 'clinical-governance',
    primaryOwnerRole: entry.primaryOwnerRole ?? 'Primary Care Clinical Reviewer',
    backupOwnerRole: entry.backupOwnerRole ?? 'Clinical Governance Backup',
    refreshCadenceDays: entry.refreshCadenceDays ?? 180,
    governanceNotes: entry.governanceNotes ?? [`Pilot governed source ${index + 1}; refresh ownership is explicit.`],
    topics: entry.topics ?? [],
    sourceUrl: entry.url,
    lastReviewedAt: entry.lastReviewedAt ?? '2026-04-24T00:00:00Z',
    nextReviewDueAt: entry.nextReviewDueAt ?? '2026-10-21T00:00:00Z',
    ...(entry.supersededBy ? { supersededBy: entry.supersededBy } : {}),
  };
}

/**
 * @param {any} compactPack
 * @returns {any}
 */
function expandCompactKnowledgePack(compactPack) {
  const slug = compactId(compactPack.canonicalDiseaseName);
  const primarySource = sourceId(slug, 'primary-guidance');
  const secondarySource = sourceId(slug, 'review-source');
  const sourceCatalog = [
    expandCompactSource({
      id: primarySource,
      label: compactPack.primarySourceLabel,
      type: compactPack.primarySourceType ?? 'guideline',
      tier: 'tier-1',
      url: compactPack.primarySourceUrl,
      backupOwnerRole: compactPack.backupOwnerRole,
      topics: compactPack.educationalFocus,
    }, 0),
    expandCompactSource({
      id: secondarySource,
      label: compactPack.secondarySourceLabel,
      type: compactPack.secondarySourceType ?? 'reference',
      tier: compactPack.secondarySourceTier ?? 'tier-2',
      url: compactPack.secondarySourceUrl,
      backupOwnerRole: compactPack.backupOwnerRole,
      topics: compactPack.educationalFocus,
    }, 1),
  ].map((sourceEntry) => ({
    ...sourceEntry,
    canonicalDiseaseName: compactPack.canonicalDiseaseName,
  }));
  const evidence = [
    {
      claimId: claimId(slug, '001'),
      claimText: compactPack.mechanismClaim,
      sourceId: primarySource,
      sourceType: sourceCatalog[0].sourceType,
      sourceLabel: sourceCatalog[0].sourceLabel,
      sourceLocator: 'definition, mechanism, or clinical overview',
      confidence: 0.95,
      lastReviewedAt: sourceCatalog[0].lastReviewedAt,
      applicability: 'Primary care teaching baseline',
      claimType: 'core-mechanism',
      certaintyLevel: 'high',
      diseaseStageApplicability: 'baseline recognition',
      patientSubgroupApplicability: compactPack.patientSubgroupApplicability ?? 'Adults in primary care',
      importanceRank: 1,
    },
    {
      claimId: claimId(slug, '002'),
      claimText: compactPack.diagnosticClaim,
      sourceId: primarySource,
      sourceType: sourceCatalog[0].sourceType,
      sourceLabel: sourceCatalog[0].sourceLabel,
      sourceLocator: 'diagnosis and evaluation guidance',
      confidence: 0.94,
      lastReviewedAt: sourceCatalog[0].lastReviewedAt,
      applicability: 'Primary care diagnostic framing',
      claimType: 'diagnostic',
      certaintyLevel: 'high',
      diseaseStageApplicability: 'evaluation',
      patientSubgroupApplicability: compactPack.patientSubgroupApplicability ?? 'Adults in primary care',
      importanceRank: 2,
    },
    {
      claimId: claimId(slug, '003'),
      claimText: compactPack.managementClaim,
      sourceId: secondarySource,
      sourceType: sourceCatalog[1].sourceType,
      sourceLabel: sourceCatalog[1].sourceLabel,
      sourceLocator: 'management guidance',
      confidence: 0.93,
      lastReviewedAt: sourceCatalog[1].lastReviewedAt,
      applicability: 'Primary care management framing',
      claimType: 'management',
      certaintyLevel: 'high',
      diseaseStageApplicability: 'treatment planning',
      patientSubgroupApplicability: compactPack.patientSubgroupApplicability ?? 'Adults in primary care',
      importanceRank: 3,
    },
    {
      claimId: claimId(slug, '004'),
      claimText: compactPack.safetyClaim,
      sourceId: secondarySource,
      sourceType: sourceCatalog[1].sourceType,
      sourceLabel: sourceCatalog[1].sourceLabel,
      sourceLocator: 'safety, escalation, or red-flag guidance',
      confidence: 0.91,
      lastReviewedAt: sourceCatalog[1].lastReviewedAt,
      applicability: 'Reviewer-facing safety boundary',
      claimType: 'safety-boundary',
      certaintyLevel: 'moderate',
      diseaseStageApplicability: 'escalation and exception handling',
      patientSubgroupApplicability: compactPack.patientSubgroupApplicability ?? 'Adults in primary care',
      importanceRank: 4,
    },
  ];

  return {
    schemaVersion: '1.0.0',
    id: `dkp.${normalizeKey(compactPack.canonicalDiseaseName)}`,
    canonicalDiseaseName: compactPack.canonicalDiseaseName,
    packStatus: 'promoted',
    packScope: 'library',
    generationMode: 'local-fixture',
    sourceOrigins: {
      seeded: sourceCatalog.length,
      'user-doc': 0,
      'agent-web': 0,
      'local-fixture': 0,
    },
    aliases: compactPack.aliases,
    ontologyId: compactPack.ontologyId,
    diseaseCategory: compactPack.diseaseCategory,
    educationalFocus: compactPack.educationalFocus,
    clinicalSummary: {
      oneSentence: compactPack.oneSentence,
      keyMechanism: compactPack.keyMechanism,
      timeScale: compactPack.timeScale,
      patientExperienceSummary: compactPack.patientExperienceSummary,
    },
    physiologyPrerequisites: compactPack.physiologyPrerequisites,
    pathophysiology: [
      {
        order: 1,
        event: compactPack.pathophysiologyEvent,
        mechanism: compactPack.keyMechanism,
        scale: compactPack.pathophysiologyScale ?? 'organ',
        linkedClaimIds: [claimId(slug, '001')],
      },
      {
        order: 2,
        event: compactPack.clinicalConsequenceEvent,
        mechanism: compactPack.clinicalConsequenceMechanism,
        scale: compactPack.clinicalConsequenceScale ?? 'whole-body',
        linkedClaimIds: [claimId(slug, '001'), claimId(slug, '002')],
      },
    ],
    presentation: compactPack.presentation,
    diagnostics: compactPack.diagnostics,
    management: compactPack.management,
    evidence,
    sourceCatalog,
    clinicalTeachingPoints: [
      {
        order: 1,
        title: compactPack.teachingTitle,
        teachingPoint: compactPack.teachingPoint,
        linkedClaimIds: [claimId(slug, '001'), claimId(slug, '002')],
      },
      {
        order: 2,
        title: compactPack.safetyTitle,
        teachingPoint: compactPack.safetyTeachingPoint,
        linkedClaimIds: [claimId(slug, '003'), claimId(slug, '004')],
      },
    ],
    visualAnchors: [
      {
        anchorId: `vanchor.${slug}.001`,
        title: compactPack.visualAnchorTitle,
        bodyScale: compactPack.visualAnchorScale ?? 'organ',
        location: compactPack.visualAnchorLocation,
        description: compactPack.visualAnchorDescription,
        linkedClaimIds: [claimId(slug, '001'), claimId(slug, '002')],
      },
      {
        anchorId: `vanchor.${slug}.002`,
        title: compactPack.safetyVisualTitle,
        bodyScale: compactPack.safetyVisualScale ?? 'story',
        location: compactPack.safetyVisualLocation ?? 'case board',
        description: compactPack.safetyVisualDescription,
        linkedClaimIds: [claimId(slug, '003'), claimId(slug, '004')],
      },
    ],
    evidenceRelationships: [
      {
        fromClaimId: claimId(slug, '001'),
        toClaimId: claimId(slug, '002'),
        relationshipType: 'supports',
        status: 'resolved',
        notes: 'Mechanism supports recognition and diagnostic framing.',
      },
      {
        fromClaimId: claimId(slug, '003'),
        toClaimId: claimId(slug, '004'),
        relationshipType: 'qualifies',
        status: 'monitor',
        notes: compactPack.governanceEdgeNote ?? 'Treatment teaching must preserve escalation and exception boundaries.',
      },
    ],
    generatedAt: '2026-04-24T00:00:00Z',
    generatedBy: 'local-pilot-governed-library',
  };
}

/**
 * @param {string} rootDir
 * @returns {string}
 */
function getKnowledgePackDir(rootDir) {
  return path.join(rootDir, KNOWLEDGE_PACK_DIRECTORY);
}

/**
 * @param {string} rootDir
 * @returns {any[]}
 */
function loadKnowledgePackList(rootDir) {
  const knowledgePackDir = getKnowledgePackDir(rootDir);
  const fileNames = readdirSync(knowledgePackDir)
    .filter((fileName) => fileName.endsWith('.json') && fileName !== 'ambiguous-inputs.json')
    .sort();

  return fileNames.flatMap((fileName) => {
    const contents = readFileSync(path.join(knowledgePackDir, fileName), 'utf8');
    const parsed = JSON.parse(contents);

    if (Array.isArray(parsed)) {
      return parsed;
    }

    if (Array.isArray(parsed.knowledgePacks)) {
      return parsed.knowledgePacks;
    }

    if (parsed.format === 'pilot-care-compact-v1' && Array.isArray(parsed.conditions)) {
      return parsed.conditions.map(expandCompactKnowledgePack);
    }

    return [parsed];
  });
}

/**
 * @param {string} rootDir
 * @returns {Record<string, any[]>}
 */
function loadAmbiguousInputs(rootDir) {
  const cacheKey = rootDir;

  if (ambiguousInputCache.has(cacheKey)) {
    const cached = ambiguousInputCache.get(cacheKey);

    if (cached) {
      return cached;
    }
  }

  const ambiguousInputPath = path.join(getKnowledgePackDir(rootDir), 'ambiguous-inputs.json');
  const parsed = JSON.parse(readFileSync(ambiguousInputPath, 'utf8'));
  ambiguousInputCache.set(cacheKey, parsed);
  return parsed;
}

/**
 * @param {string} [rootDir]
 * @returns {Record<string, any>}
 */
export function createSeedDiseaseLibrary(rootDir = findRepoRoot(import.meta.url)) {
  const cacheKey = rootDir;

  if (libraryCache.has(cacheKey)) {
    const cached = libraryCache.get(cacheKey);

    if (cached) {
      return cached;
    }
  }

  /** @type {Record<string, any>} */
  const library = {};

  for (const knowledgePack of loadKnowledgePackList(rootDir)) {
    const key = normalizeKey(knowledgePack.canonicalDiseaseName);
    const existing = library[key];

    if (existing?.packStatus === 'promoted' && knowledgePack.packStatus !== 'promoted') {
      continue;
    }

    library[key] = structuredClone(knowledgePack);
  }

  libraryCache.set(cacheKey, library);
  return library;
}

export const AMBIGUOUS_INPUTS = loadAmbiguousInputs(findRepoRoot(import.meta.url));
