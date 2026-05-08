import { createId } from '../../../packages/shared-config/src/ids.mjs';
import { normalizeDiseaseInput } from './ontology-adapter.mjs';

const SCHEMA_VERSION = '1.0.0';
const DEFAULT_ALLOWED_DOMAINS = Object.freeze([
  'pubmed.ncbi.nlm.nih.gov',
  'www.ncbi.nlm.nih.gov',
  'clinicaltrials.gov',
  'www.cdc.gov',
  'www.nih.gov',
  'www.nhlbi.nih.gov',
  'www.ninds.nih.gov',
  'www.niddk.nih.gov',
  'www.fda.gov',
  'www.who.int',
  'medlineplus.gov',
]);
const ALLOWED_SOURCE_TYPES = new Set(['guideline', 'review', 'trial', 'textbook', 'reference']);
const SAFE_ID_PATTERN = /^[A-Za-z0-9._:-]+$/u;
const MEDICAL_DOSSIER_SECTION_KEYS = Object.freeze([
  'epidemiology',
  'etiology',
  'pathophysiology',
  'clinicalFeatures',
  'history',
  'exam',
  'labs',
  'imaging',
  'diagnosticCriteria',
  'differentialDiagnosis',
  'treatment',
  'management',
  'complications',
  'prognosis',
  'teachingPoints',
  'visualAnchors',
]);
const MEDICAL_DOSSIER_SECTION_TITLES = Object.freeze({
  epidemiology: 'Epidemiology',
  etiology: 'Etiology',
  pathophysiology: 'Pathophysiology',
  clinicalFeatures: 'Clinical Features',
  history: 'History',
  exam: 'Exam',
  labs: 'Labs',
  imaging: 'Imaging',
  diagnosticCriteria: 'Diagnostic Criteria',
  differentialDiagnosis: 'Differential Diagnosis',
  treatment: 'Treatment',
  management: 'Management',
  complications: 'Complications',
  prognosis: 'Prognosis',
  teachingPoints: 'Teaching Points',
  visualAnchors: 'Visual Anchors',
});
const RESEARCH_AGENT_DEFINITIONS = Object.freeze([
  ['canonicalization', 'Disease Canonicalization Agent'],
  ['source-discovery', 'Medical Source Discovery Agent'],
  ['epidemiology-etiology', 'Epidemiology/Etiology Agent'],
  ['pathophysiology', 'Pathophysiology Agent'],
  ['clinical-features', 'Clinical Features Agent'],
  ['exam-lab-imaging', 'Exam/Lab/Imaging Agent'],
  ['diagnostics-differential', 'Diagnostic Criteria/Differential Agent'],
  ['treatment-management', 'Treatment/Management Agent'],
  ['complications-prognosis', 'Complications/Prognosis Agent'],
  ['evidence-synthesis', 'Evidence Synthesis Agent'],
  ['contradiction-governance', 'Contradiction/Governance Agent'],
  ['medical-dossier-qa', 'Medical Dossier QA Agent'],
]);

/**
 * @param {string} sectionKey
 * @returns {string}
 */
function sectionTitle(sectionKey) {
  return /** @type {Record<string, string>} */ (MEDICAL_DOSSIER_SECTION_TITLES)[sectionKey] ?? sectionKey;
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, any>}
 */
function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * @param {string} value
 * @returns {string}
 */
function normalizeId(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * @param {unknown} value
 * @param {string} fallback
 * @returns {string}
 */
function normalizeSafeId(value, fallback) {
  const candidate = typeof value === 'string' ? value.trim() : '';
  return SAFE_ID_PATTERN.test(candidate) ? candidate : fallback;
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function toStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean);
}

/**
 * @param {string[]} values
 * @returns {string[]}
 */
function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

/**
 * @param {unknown} value
 * @returns {any[]}
 */
function toObjectArray(value) {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

/**
 * @param {string | undefined} value
 * @returns {string | undefined}
 */
function readNonEmptyEnv(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/**
 * @param {string} rawInput
 * @returns {string}
 */
function toCanonicalDiseaseLabel(rawInput) {
  return rawInput
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((token) => token ? `${token[0].toUpperCase()}${token.slice(1)}` : token)
    .join(' ');
}

/**
 * @param {any} payload
 * @returns {string}
 */
function extractOutputText(payload) {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text;
  }

  const contentFragments = [];

  for (const item of payload?.output ?? []) {
    if (!Array.isArray(item?.content)) {
      continue;
    }

    for (const content of item.content) {
      if (typeof content?.text === 'string' && content.text.trim()) {
        contentFragments.push(content.text);
      }
    }
  }

  return contentFragments.join('\n').trim();
}

/**
 * @param {any} payload
 * @returns {any[]}
 */
function collectResponseSources(payload) {
  const harvested = [];

  for (const item of payload?.output ?? []) {
    if (Array.isArray(item?.sources)) {
      harvested.push(...item.sources);
    }

    if (Array.isArray(item?.action?.sources)) {
      harvested.push(...item.action.sources);
    }
  }

  return harvested.filter(isRecord);
}

/**
 * @param {any} source
 * @returns {string}
 */
function normalizeSourceType(source) {
  const candidate = String(source?.sourceType ?? source?.type ?? 'reference').toLowerCase();
  return ALLOWED_SOURCE_TYPES.has(candidate) ? candidate : 'reference';
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function normalizeConfidence(value) {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));

  if (!Number.isFinite(parsed)) {
    return 0.8;
  }

  if (parsed >= 0 && parsed <= 1) {
    return parsed;
  }

  if (parsed > 1 && parsed <= 100) {
    return parsed / 100;
  }

  return 0.8;
}

/**
 * @param {unknown} value
 * @returns {'high' | 'moderate' | 'guarded'}
 */
function normalizeCertaintyLevel(value) {
  const candidate = String(value ?? '').trim().toLowerCase();

  if (['high', 'strong', 'certain', 'well-supported'].includes(candidate)) {
    return 'high';
  }

  if (['moderate', 'medium', 'fair', 'mixed'].includes(candidate)) {
    return 'moderate';
  }

  return 'guarded';
}

/**
 * @param {unknown} value
 * @returns {'tier-1' | 'tier-2' | 'tier-3' | 'tenant-pack'}
 */
function normalizeSourceTier(value) {
  const candidate = String(value ?? '').trim().toLowerCase();

  if (['tier-1', 'tier 1', 'primary', 'guideline', 'major-guideline'].includes(candidate)) {
    return 'tier-1';
  }

  if (['tier-2', 'tier 2', 'secondary', 'review', 'systematic-review'].includes(candidate)) {
    return 'tier-2';
  }

  if (['tier-3', 'tier 3', 'tertiary', 'reference', 'background'].includes(candidate)) {
    return 'tier-3';
  }

  return 'tenant-pack';
}

/**
 * @param {unknown} value
 * @returns {'approved' | 'provisional' | 'promotion-required' | 'suspended'}
 */
function normalizeReviewState(value) {
  const candidate = String(value ?? '').trim().toLowerCase().replace(/[_\s]+/gu, '-');

  if (candidate === 'approved') {
    return 'approved';
  }

  if (candidate === 'promotion-required' || candidate === 'promote' || candidate === 'needs-promotion') {
    return 'promotion-required';
  }

  if (candidate === 'suspended' || candidate === 'blocked') {
    return 'suspended';
  }

  return 'provisional';
}

/**
 * @param {unknown} value
 * @returns {'approved' | 'conditional' | 'suspended'}
 */
function normalizeApprovalStatus(value) {
  const candidate = String(value ?? '').trim().toLowerCase();

  if (candidate === 'approved') {
    return 'approved';
  }

  if (candidate === 'suspended' || candidate === 'blocked') {
    return 'suspended';
  }

  return 'conditional';
}

/**
 * @param {unknown} value
 * @returns {'seeded' | 'user-doc' | 'agent-web' | 'local-fixture'}
 */
function normalizeSourceOrigin(value) {
  const candidate = String(value ?? '').trim().toLowerCase();

  if (candidate === 'seeded' || candidate === 'user-doc' || candidate === 'agent-web' || candidate === 'local-fixture') {
    return candidate;
  }

  return 'agent-web';
}

/**
 * @param {unknown} value
 * @returns {'supports' | 'chronology' | 'contradicts' | 'qualifies'}
 */
function normalizeRelationshipType(value) {
  const candidate = String(value ?? '').trim().toLowerCase().replace(/[_\s]+/gu, '-');

  if (candidate === 'chronology' || candidate === 'precedes' || candidate === 'follows') {
    return 'chronology';
  }

  if (candidate === 'contradicts' || candidate === 'contradiction' || candidate === 'conflicts') {
    return 'contradicts';
  }

  if (candidate === 'qualifies' || candidate === 'qualification' || candidate === 'modifies') {
    return 'qualifies';
  }

  return 'supports';
}

/**
 * @param {unknown} value
 * @returns {'open' | 'monitor' | 'blocking' | 'resolved'}
 */
function normalizeRelationshipStatus(value) {
  const candidate = String(value ?? '').trim().toLowerCase();

  if (candidate === 'blocking' || candidate === 'blocked') {
    return 'blocking';
  }

  if (candidate === 'resolved') {
    return 'resolved';
  }

  if (candidate === 'monitor' || candidate === 'monitoring') {
    return 'monitor';
  }

  return 'open';
}

/**
 * @param {unknown} value
 * @param {{ blockingIssues: string[], warnings: string[] }} context
 * @returns {'ready' | 'review-required' | 'blocked'}
 */
function normalizeBuildReportStatus(value, context) {
  const candidate = typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[_\s]+/gu, '-')
    : '';

  if (candidate === 'ready' || candidate === 'approved' || candidate === 'complete' || candidate === 'completed' || candidate === 'success' || candidate === 'succeeded') {
    return context.blockingIssues.length > 0
      ? 'blocked'
      : (context.warnings.length > 0 ? 'review-required' : 'ready');
  }

  if (candidate === 'review-required' || candidate === 'needs-review' || candidate === 'warning' || candidate === 'warnings' || candidate === 'conditional' || candidate === 'provisional') {
    return context.blockingIssues.length > 0 ? 'blocked' : 'review-required';
  }

  if (candidate === 'blocked' || candidate === 'failed' || candidate === 'failure' || candidate === 'unsafe') {
    return 'blocked';
  }

  return context.blockingIssues.length > 0
    ? 'blocked'
    : (context.warnings.length > 0 ? 'review-required' : 'ready');
}

/**
 * @param {any} draft
 * @param {{ canonicalDiseaseName: string, workflowRunId: string, timestamp: string }} options
 * @returns {any}
 */
function normalizeKnowledgePack(draft, options) {
  const diseaseSlug = normalizeId(options.canonicalDiseaseName);
  const sourceIdMap = new Map();
  const draftSourceCatalog = toObjectArray(draft?.sourceCatalog);
  let sourceCatalog = draftSourceCatalog.map((entry, index) => ({
    id: normalizeSafeId(entry.id, `src.${diseaseSlug}.${String(index + 1).padStart(3, '0')}`),
    canonicalDiseaseName: options.canonicalDiseaseName,
    sourceLabel: String(entry.sourceLabel ?? entry.title ?? ''),
    sourceType: normalizeSourceType(entry),
    sourceTier: normalizeSourceTier(entry.sourceTier),
    origin: normalizeSourceOrigin(entry.origin),
    retrievedAt: typeof entry.retrievedAt === 'string' ? entry.retrievedAt : options.timestamp,
    captureMethod: String(entry.captureMethod ?? 'responses-web-search'),
    reviewState: normalizeReviewState(entry.reviewState),
    defaultApprovalStatus: normalizeApprovalStatus(entry.defaultApprovalStatus),
    owner: String(entry.owner ?? 'clinical-governance'),
    primaryOwnerRole: String(entry.primaryOwnerRole ?? 'Clinical Reviewer'),
    backupOwnerRole: String(entry.backupOwnerRole ?? 'Product Editor'),
    refreshCadenceDays: Number.isInteger(entry.refreshCadenceDays) ? entry.refreshCadenceDays : 180,
    governanceNotes: toStringArray(entry.governanceNotes),
    topics: toStringArray(entry.topics),
    ...(typeof entry.sourceUrl === 'string' ? { sourceUrl: entry.sourceUrl } : {}),
    lastReviewedAt: typeof entry.lastReviewedAt === 'string' ? entry.lastReviewedAt : options.timestamp,
  })).map((entry, index) => {
    const originalId = draftSourceCatalog[index]?.id;

    if (typeof originalId === 'string') {
      sourceIdMap.set(originalId, entry.id);
    }

    return entry;
  });
  if (sourceCatalog.length === 0) {
    sourceCatalog = [
      {
        id: `src.${diseaseSlug}.agent-provisional`,
        canonicalDiseaseName: options.canonicalDiseaseName,
        sourceLabel: `Agent provisional research context for ${options.canonicalDiseaseName}`,
        sourceType: 'reference',
        sourceTier: 'tenant-pack',
        origin: 'agent-web',
        retrievedAt: options.timestamp,
        captureMethod: 'responses-research-assembly',
        reviewState: 'provisional',
        defaultApprovalStatus: 'conditional',
        owner: 'clinical-governance',
        primaryOwnerRole: 'Clinical Reviewer',
        backupOwnerRole: 'Product Editor',
        refreshCadenceDays: 30,
        governanceNotes: ['Agent output omitted source catalog entries; reviewer source governance is required.'],
        topics: ['provisional source governance'],
        sourceUrl: `agent-provisional://${diseaseSlug}`,
        lastReviewedAt: options.timestamp,
      },
    ];
  }
  const claimIdMap = new Map();
  let evidence = toObjectArray(draft?.evidence).map((record, index) => {
    const claimId = normalizeSafeId(record.claimId, `clm.${diseaseSlug}.${String(index + 1).padStart(3, '0')}`);
    const fallbackSourceId = sourceCatalog[index]?.id ?? sourceCatalog[0]?.id ?? `src.${diseaseSlug}.${String(index + 1).padStart(3, '0')}`;
    const mappedSourceId = typeof record.sourceId === 'string'
      ? sourceIdMap.get(record.sourceId) ?? normalizeSafeId(record.sourceId, fallbackSourceId)
      : fallbackSourceId;
    const sourceId = sourceCatalog.some((entry) => entry.id === mappedSourceId) ? mappedSourceId : fallbackSourceId;

    if (typeof record.claimId === 'string') {
      claimIdMap.set(record.claimId, claimId);
    }

    return {
      claimId,
      claimText: String(record.claimText ?? ''),
      sourceId,
      sourceType: normalizeSourceType(record),
      sourceLabel: String(record.sourceLabel ?? sourceCatalog.find((entry) => entry.id === sourceId)?.sourceLabel ?? ''),
      sourceLocator: String(record.sourceLocator ?? record.sourceUrl ?? sourceCatalog.find((entry) => entry.id === sourceId)?.sourceUrl ?? ''),
      confidence: normalizeConfidence(record.confidence),
      ...(typeof record.lastReviewedAt === 'string' ? { lastReviewedAt: record.lastReviewedAt } : {}),
      ...(typeof record.applicability === 'string' ? { applicability: record.applicability } : {}),
      ...(typeof record.claimType === 'string' ? { claimType: record.claimType } : {}),
      certaintyLevel: normalizeCertaintyLevel(record.certaintyLevel),
      ...(typeof record.diseaseStageApplicability === 'string' ? { diseaseStageApplicability: record.diseaseStageApplicability } : {}),
      ...(typeof record.patientSubgroupApplicability === 'string' ? { patientSubgroupApplicability: record.patientSubgroupApplicability } : {}),
      ...(Number.isInteger(record.importanceRank) ? { importanceRank: record.importanceRank } : { importanceRank: index + 1 }),
    };
  });
  if (evidence.length === 0) {
    evidence = [
      {
        claimId: `clm.${diseaseSlug}.001`,
        claimText: `${options.canonicalDiseaseName} requires reviewer-approved condition-specific evidence before publication-ready medical claims can be made.`,
        sourceId: sourceCatalog[0].id,
        sourceType: sourceCatalog[0].sourceType,
        sourceLabel: sourceCatalog[0].sourceLabel,
        sourceLocator: sourceCatalog[0].sourceUrl ?? 'agent provisional source context',
        confidence: 0.5,
        claimType: 'governance',
        certaintyLevel: 'guarded',
        diseaseStageApplicability: 'all stages pending review',
        patientSubgroupApplicability: 'general pending review',
        importanceRank: 1,
      },
    ];
  }
  const validClaimIds = new Set(evidence.map((record) => record.claimId));
  const educationalFocus = toStringArray(draft?.educationalFocus);
  const clinicalTeachingPoints = toObjectArray(draft?.clinicalTeachingPoints);
  const visualAnchors = toObjectArray(draft?.visualAnchors);

  return {
    schemaVersion: SCHEMA_VERSION,
    id: draft?.id ?? `kp.${diseaseSlug}.${normalizeId(options.workflowRunId)}`,
    canonicalDiseaseName: String(draft?.canonicalDiseaseName ?? options.canonicalDiseaseName),
    packStatus: String(draft?.packStatus ?? 'provisional'),
    packScope: String(draft?.packScope ?? 'run'),
    generationMode: String(draft?.generationMode ?? 'agent-generated'),
    derivedFromRunId: options.workflowRunId,
    sourceOrigins: isRecord(draft?.sourceOrigins)
      ? draft.sourceOrigins
      : { seeded: 0, 'user-doc': 0, 'agent-web': sourceCatalog.length },
    aliases: toStringArray(draft?.aliases).length > 0 ? toStringArray(draft?.aliases) : [options.canonicalDiseaseName],
    ontologyId: String(draft?.ontologyId ?? `prov:${diseaseSlug}`),
    diseaseCategory: String(draft?.diseaseCategory ?? 'provisional-research-needed'),
    educationalFocus: educationalFocus.length > 0
      ? educationalFocus
      : ['source-backed disease mechanism', 'fair diagnostic clue sequencing', 'treatment as story climax'],
    clinicalSummary: isRecord(draft?.clinicalSummary) ? draft.clinicalSummary : {},
    physiologyPrerequisites: toObjectArray(draft?.physiologyPrerequisites),
    pathophysiology: toObjectArray(draft?.pathophysiology),
    presentation: isRecord(draft?.presentation) ? draft.presentation : {},
    diagnostics: isRecord(draft?.diagnostics) ? draft.diagnostics : {},
    management: isRecord(draft?.management) ? draft.management : {},
    evidence,
    sourceCatalog,
    clinicalTeachingPoints: clinicalTeachingPoints.length > 0
      ? clinicalTeachingPoints
      : [
        {
          order: 1,
          title: 'Reviewer-gated clinical teaching point',
          teachingPoint: 'The provisional pack compiled successfully, but reviewers must confirm disease-specific teaching points against approved sources before release.',
          linkedClaimIds: [evidence[0].claimId],
        },
      ],
    visualAnchors: visualAnchors.length > 0
      ? visualAnchors
      : [
        {
          anchorId: `vanchor.${diseaseSlug}.001`,
          title: 'Evidence review checkpoint',
          bodyScale: 'story',
          location: 'case board',
          description: 'Show the detectives organizing source-backed clues before entering the body-world.',
          linkedClaimIds: [evidence[0].claimId],
        },
      ],
    evidenceRelationships: toObjectArray(draft?.evidenceRelationships)
      .map((relationship) => {
        const fromClaimId = typeof relationship.fromClaimId === 'string'
          ? (claimIdMap.get(relationship.fromClaimId) ?? relationship.fromClaimId)
          : '';
        const toClaimId = typeof relationship.toClaimId === 'string'
          ? (claimIdMap.get(relationship.toClaimId) ?? relationship.toClaimId)
          : '';

        if (!validClaimIds.has(fromClaimId) || !validClaimIds.has(toClaimId)) {
          return null;
        }

        return {
          fromClaimId,
          toClaimId,
          relationshipType: normalizeRelationshipType(relationship.relationshipType),
          status: normalizeRelationshipStatus(relationship.status),
          ...(typeof relationship.notes === 'string' ? { notes: relationship.notes } : {}),
        };
      })
      .filter(Boolean),
    generatedAt: options.timestamp,
    generatedBy: 'research-assembly-agent',
  };
}

/**
 * @param {{ workflowRun: any, workflowInput: any, canonicalDisease: any, allowedDomains: string[], knowledgeBaseVectorStoreId?: string }} options
 * @returns {any}
 */
function buildResearchBrief(options) {
  const knowledgeBaseVectorStoreConfigured = Boolean(options.knowledgeBaseVectorStoreId?.trim());

  return {
    schemaVersion: SCHEMA_VERSION,
    id: createId('rbr'),
    tenantId: options.workflowRun.tenantId,
    workflowRunId: options.workflowRun.id,
    rawDiseaseInput: options.workflowInput.diseaseName,
    normalizedDiseaseInput: normalizeDiseaseInput(options.workflowInput.diseaseName),
    targetCanonicalDiseaseName: options.canonicalDisease.canonicalDiseaseName ?? toCanonicalDiseaseLabel(options.workflowInput.diseaseName),
    audienceTier: options.workflowInput.audienceTier ?? 'general-clinical',
    lengthProfile: options.workflowInput.lengthProfile ?? 'standard',
    qualityProfile: options.workflowInput.qualityProfile ?? 'commercial-grade',
    styleProfile: options.workflowInput.styleProfile ?? 'alien-detective-clinical-mystery',
    researchIntent: 'Compile a medically traceable provisional disease knowledge pack that can support downstream comic production artifacts.',
    knowledgeBaseVectorStoreConfigured,
    researchTooling: [
      ...(knowledgeBaseVectorStoreConfigured ? ['openai-file-search'] : []),
      ...(options.allowedDomains.length > 0 ? ['openai-web-search'] : []),
    ],
    allowedDomains: options.allowedDomains,
    createdAt: new Date().toISOString(),
  };
}

/**
 * @param {any[]} responseSources
 * @param {any} knowledgePack
 * @param {{ workflowRun: any, canonicalDiseaseName: string, timestamp: string }} options
 * @returns {any}
 */
function buildSourceHarvest(responseSources, knowledgePack, options) {
  const sources = (knowledgePack.sourceCatalog ?? []).map((/** @type {any} */ sourceEntry) => ({
    sourceId: sourceEntry.id,
    sourceLabel: sourceEntry.sourceLabel,
    sourceType: sourceEntry.sourceType,
    origin: sourceEntry.origin ?? 'agent-web',
    sourceUrl: sourceEntry.sourceUrl ?? '',
    retrievedAt: sourceEntry.retrievedAt ?? options.timestamp,
    captureMethod: sourceEntry.captureMethod ?? 'responses-web-search',
    status: sourceEntry.reviewState ?? 'provisional',
  }));
  const knownUrls = new Set(sources.map((/** @type {{ sourceUrl?: string }} */ entry) => entry.sourceUrl).filter(Boolean));

  for (const responseSource of responseSources) {
    const url = String(responseSource.url ?? '');

    if (!url || knownUrls.has(url)) {
      continue;
    }

    sources.push({
      sourceId: createId('src'),
      sourceLabel: String(responseSource.title ?? responseSource.url ?? 'Web source'),
      sourceType: 'reference',
      origin: 'agent-web',
      sourceUrl: url,
      retrievedAt: options.timestamp,
      captureMethod: 'responses-web-search',
      status: 'captured-not-linked',
    });
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    id: createId('shr'),
    tenantId: options.workflowRun.tenantId,
    workflowRunId: options.workflowRun.id,
    targetCanonicalDiseaseName: options.canonicalDiseaseName,
    sources,
    droppedSources: [],
    generatedAt: options.timestamp,
  };
}

/**
 * @param {any[]} steps
 * @param {{ workflowRun: any, model: string, status: 'succeeded' | 'review-required' | 'failed', startedAt: string, endedAt: string, producedArtifactIds?: string[], blockedReason?: string, id?: string }} options
 * @returns {any}
 */
function buildAgentRun(steps, options) {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: options.id ?? createId('arun'),
    tenantId: options.workflowRun.tenantId,
    workflowRunId: options.workflowRun.id,
    purpose: 'research-disease-medical-dossier',
    status: options.status,
    model: options.model,
    orchestration: 'openai-agents-sdk',
    tooling: ['structured-json', 'web-search', ...(process.env.KB_VECTOR_STORE_ID ? ['file-search'] : [])],
    stepIds: steps.map((step) => step.id),
    producedArtifactIds: options.producedArtifactIds ?? [],
    summary: 'Compiled a high-yield medical dossier for local reviewer approval before story generation.',
    ...(options.blockedReason ? { blockedReason: options.blockedReason } : {}),
    startedAt: options.startedAt,
    endedAt: options.endedAt,
  };
}

/**
 * @param {{ workflowRun: any, agentRunId: string, stepKey: string, agentName: string, status?: 'succeeded' | 'review-required' | 'failed', inputSummary: string, outputSummary: string, timestamp: string, findings?: string[], artifactIds?: string[] }} options
 * @returns {any}
 */
function buildAgentStep(options) {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: createId('astep'),
    tenantId: options.workflowRun.tenantId,
    workflowRunId: options.workflowRun.id,
    agentRunId: options.agentRunId,
    stepKey: options.stepKey,
    agentName: options.agentName,
    status: options.status ?? 'succeeded',
    inputSummary: options.inputSummary,
    outputSummary: options.outputSummary,
    toolSummary: ['structured-json'],
    findings: options.findings ?? [],
    artifactIds: options.artifactIds ?? [],
    startedAt: options.timestamp,
    endedAt: options.timestamp,
  };
}

/**
 * @param {{ workflowRun: any, agentRunId: string, canonicalDiseaseName: string, sourceHarvest: any, allowedDomains: string[], timestamp: string, gaps?: string[] }} options
 * @returns {any}
 */
function buildSourceDiscoveryReport(options) {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: createId('sdr'),
    tenantId: options.workflowRun.tenantId,
    workflowRunId: options.workflowRun.id,
    targetCanonicalDiseaseName: options.canonicalDiseaseName,
    agentRunId: options.agentRunId,
    searchStrategy: 'Prioritize guideline, review, trial, public-health, and curated knowledge-base sources; preserve uncertainty for reviewer governance.',
    allowedDomains: options.allowedDomains,
    sources: (options.sourceHarvest.sources ?? []).map((/** @type {any} */ source) => ({
      sourceId: source.sourceId,
      sourceLabel: source.sourceLabel,
      sourceType: source.sourceType,
      origin: source.origin,
      ...(source.sourceUrl ? { sourceUrl: source.sourceUrl } : {}),
      status: source.status,
      topics: [],
    })),
    droppedSources: options.sourceHarvest.droppedSources ?? [],
    gaps: options.gaps ?? [],
    generatedAt: options.timestamp,
  };
}

/**
 * @param {string} sectionKey
 * @param {any} knowledgePack
 * @returns {any[]}
 */
function findClaimsForSection(sectionKey, knowledgePack) {
  const evidence = /** @type {any[]} */ (knowledgePack.evidence ?? []);
  /** @type {Record<string, string[]>} */
  const keywordsBySection = {
    epidemiology: ['epidemiology', 'prevalence', 'incidence', 'risk'],
    etiology: ['etiology', 'cause', 'risk', 'trigger'],
    pathophysiology: ['pathophysiology', 'mechanism', 'physiology'],
    clinicalFeatures: ['clinical', 'symptom', 'presentation', 'feature'],
    history: ['history', 'symptom', 'presentation'],
    exam: ['exam', 'finding', 'physical'],
    labs: ['lab', 'test', 'biomarker'],
    imaging: ['imaging', 'radiology', 'x-ray', 'ct', 'mri', 'ultrasound'],
    diagnosticCriteria: ['diagnostic', 'criteria', 'diagnosis'],
    differentialDiagnosis: ['differential', 'mimic', 'red herring'],
    treatment: ['treatment', 'therapy', 'medication'],
    management: ['management', 'monitoring', 'follow-up'],
    complications: ['complication', 'adverse', 'risk'],
    prognosis: ['prognosis', 'outcome', 'course'],
    teachingPoints: ['teaching', 'high-yield', 'lesson'],
    visualAnchors: ['visual', 'anchor', 'image'],
  };
  const keywords = keywordsBySection[sectionKey] ?? [sectionKey.toLowerCase()];
  const matches = evidence.filter((record) => {
    const haystack = [
      record.claimType,
      record.claimText,
      record.applicability,
      record.diseaseStageApplicability,
    ].filter(Boolean).join(' ').toLowerCase();
    return keywords.some((/** @type {string} */ keyword) => haystack.includes(keyword));
  });

  return matches.length > 0 ? matches : evidence.slice(0, 1);
}

/**
 * @param {string} sectionKey
 * @param {any} knowledgePack
 * @returns {string}
 */
function summarizeKnowledgePackSection(sectionKey, knowledgePack) {
  if (sectionKey === 'pathophysiology' && Array.isArray(knowledgePack.pathophysiology) && knowledgePack.pathophysiology.length > 0) {
    return knowledgePack.pathophysiology.map((/** @type {any} */ entry) => entry.mechanism ?? entry.event).filter(Boolean).join(' ');
  }

  if (sectionKey === 'clinicalFeatures') {
    return [
      ...(knowledgePack.presentation?.hallmarkSymptoms ?? []),
      ...(knowledgePack.presentation?.redFlags ?? []),
    ].filter(Boolean).join(' ') || knowledgePack.clinicalSummary?.patientExperienceSummary;
  }

  if (sectionKey === 'history') {
    return (knowledgePack.presentation?.historyClues ?? []).join(' ') || knowledgePack.presentation?.typicalTimecourse;
  }

  if (sectionKey === 'exam') {
    return (knowledgePack.presentation?.examFindings ?? []).join(' ') || 'Exam findings must remain traceable to the dossier evidence.';
  }

  if (sectionKey === 'labs') {
    return (knowledgePack.diagnostics?.firstLineTests ?? []).join(' ') || 'Laboratory testing details require evidence links.';
  }

  if (sectionKey === 'imaging') {
    return (knowledgePack.diagnostics?.confirmatoryTests ?? []).join(' ') || 'Imaging is included when clinically relevant and marked as not applicable when absent.';
  }

  if (sectionKey === 'diagnosticCriteria') {
    return (knowledgePack.diagnostics?.diagnosticLogic ?? []).join(' ') || 'Diagnostic criteria must be earned from the clue ledger.';
  }

  if (sectionKey === 'treatment') {
    return (knowledgePack.management?.diseaseDirectedCare ?? []).join(' ') || 'Treatment details require source-backed management claims.';
  }

  if (sectionKey === 'management') {
    return [
      ...(knowledgePack.management?.stabilization ?? []),
      ...(knowledgePack.management?.monitoring ?? []),
    ].filter(Boolean).join(' ') || 'Management includes stabilization, monitoring, and follow-up.';
  }

  if (sectionKey === 'teachingPoints') {
    return (knowledgePack.clinicalTeachingPoints ?? []).map((/** @type {any} */ point) => point.teachingPoint).filter(Boolean).join(' ');
  }

  if (sectionKey === 'visualAnchors') {
    return (knowledgePack.visualAnchors ?? []).map((/** @type {any} */ anchor) => anchor.description).filter(Boolean).join(' ');
  }

  return knowledgePack.clinicalSummary?.oneSentence
    ?? `${knowledgePack.canonicalDiseaseName} requires source-traceable ${sectionTitle(sectionKey)} review.`;
}

/**
 * @param {any} knowledgePack
 * @param {{ workflowRun: any, agentRunId: string, sourceDiscoveryReportId: string, timestamp: string }} options
 * @returns {any}
 */
function buildMedicalDossierFromKnowledgePack(knowledgePack, options) {
  const sourceIds = (knowledgePack.sourceCatalog ?? []).map((/** @type {any} */ source) => source.id);
  const fallbackSourceId = sourceIds[0] ?? `src.${normalizeId(knowledgePack.canonicalDiseaseName)}.agent-provisional`;
  /** @type {Record<string, any>} */
  const sections = {};

  for (const sectionKey of MEDICAL_DOSSIER_SECTION_KEYS) {
    const claims = findClaimsForSection(sectionKey, knowledgePack);
    const linkedClaimIds = claims.map((claim) => claim.claimId);
    sections[sectionKey] = {
      sectionKey,
      title: sectionTitle(sectionKey),
      summary: summarizeKnowledgePackSection(sectionKey, knowledgePack) || `${sectionTitle(sectionKey)} requires reviewer confirmation.`,
      highYieldFacts: claims.map((claim) => ({
        claimId: claim.claimId,
        statement: claim.claimText,
        sourceIds: [claim.sourceId ?? fallbackSourceId],
      })),
      linkedClaimIds,
      reviewNotes: [],
    };
  }

  const claims = (knowledgePack.evidence ?? []).map((/** @type {any} */ claim) => {
    const sectionKeys = MEDICAL_DOSSIER_SECTION_KEYS.filter((sectionKey) => sections[sectionKey].linkedClaimIds.includes(claim.claimId));
    return {
      claimId: claim.claimId,
      claimText: claim.claimText,
      sectionKeys: sectionKeys.length > 0 ? sectionKeys : ['pathophysiology'],
      sourceIds: [claim.sourceId ?? fallbackSourceId],
      confidence: normalizeConfidence(claim.confidence),
    };
  });
  const missingSections = MEDICAL_DOSSIER_SECTION_KEYS.filter((/** @type {string} */ sectionKey) => (sections[sectionKey].linkedClaimIds ?? []).length === 0);
  const completedSectionCount = MEDICAL_DOSSIER_SECTION_KEYS.length - missingSections.length;

  return {
    schemaVersion: SCHEMA_VERSION,
    id: createId('mdos'),
    tenantId: options.workflowRun.tenantId,
    workflowRunId: options.workflowRun.id,
    canonicalDiseaseName: knowledgePack.canonicalDiseaseName,
    aliases: knowledgePack.aliases ?? [knowledgePack.canonicalDiseaseName],
    ontologyId: knowledgePack.ontologyId,
    diseaseCategory: knowledgePack.diseaseCategory,
    sourceDiscoveryReportId: options.sourceDiscoveryReportId,
    agentRunId: options.agentRunId,
    knowledgePackId: knowledgePack.id,
    sections,
    claims,
    sourceIds,
    contradictions: (knowledgePack.evidenceRelationships ?? [])
      .filter((/** @type {any} */ relationship) => relationship.relationshipType === 'contradicts')
      .map((/** @type {any} */ relationship) => ({
        fromClaimId: relationship.fromClaimId,
        toClaimId: relationship.toClaimId,
        status: relationship.status,
        ...(relationship.notes ? { notes: relationship.notes } : {}),
      })),
    completeness: {
      requiredSectionCount: MEDICAL_DOSSIER_SECTION_KEYS.length,
      completedSectionCount,
      missingSections,
      traceabilityScore: claims.length === 0 ? 0 : claims.filter((/** @type {any} */ claim) => claim.sourceIds.length > 0).length / claims.length,
    },
    reviewStatus: 'review-required',
    guidancePackVersionIds: [],
    generatedAt: options.timestamp,
    generatedBy: knowledgePack.generationMode === 'local-fixture' ? 'local-fixture-research-assembly' : 'openai-agents-sdk',
  };
}

/**
 * @param {{ workflowRun: any, medicalDossier: any, knowledgePack: any, buildReport: any, agentRunId: string, timestamp: string }} options
 * @returns {any}
 */
function buildMedicalDossierQaReport(options) {
  const blockingIssues = [
    ...toStringArray(options.buildReport?.blockingIssues),
    ...options.medicalDossier.completeness.missingSections.map((/** @type {string} */ sectionKey) => `Missing required medical dossier section: ${sectionKey}.`),
  ];
  const sourceGovernanceStatus = options.knowledgePack.generationMode === 'local-fixture'
    ? 'blocked'
    : (options.knowledgePack.sourceCatalog ?? []).some((/** @type {any} */ source) => source.reviewState === 'suspended')
    ? 'blocked'
    : 'review-required';
  const contradictionStatus = (options.medicalDossier.contradictions ?? []).some((/** @type {any} */ contradiction) => contradiction.status === 'blocking')
    ? 'blocking'
    : ((options.medicalDossier.contradictions ?? []).length > 0 ? 'monitor' : 'clear');
  const status = blockingIssues.length > 0 || sourceGovernanceStatus === 'blocked' || contradictionStatus === 'blocking'
    ? 'failed'
    : 'review-required';

  return {
    schemaVersion: SCHEMA_VERSION,
    id: createId('mdq'),
    tenantId: options.workflowRun.tenantId,
    workflowRunId: options.workflowRun.id,
    medicalDossierId: options.medicalDossier.id,
    agentRunId: options.agentRunId,
    status,
    completenessScore: options.medicalDossier.completeness.completedSectionCount / Math.max(1, options.medicalDossier.completeness.requiredSectionCount),
    traceabilityScore: options.medicalDossier.completeness.traceabilityScore,
    sourceGovernanceStatus,
    contradictionStatus,
    checks: [
      {
        checkId: 'medical-dossier.required-sections',
        status: options.medicalDossier.completeness.missingSections.length === 0 ? 'passed' : 'failed',
        message: options.medicalDossier.completeness.missingSections.length === 0
          ? 'All required high-yield medical sections are present.'
          : `Missing sections: ${options.medicalDossier.completeness.missingSections.join(', ')}.`,
      },
      {
        checkId: 'medical-dossier.traceability',
        status: options.medicalDossier.completeness.traceabilityScore >= 0.95 ? 'passed' : 'failed',
        message: 'Every clinically meaningful claim must link to source records before story generation.',
      },
      {
        checkId: 'medical-dossier.reviewer-gate',
        status: 'warning',
        message: 'Reviewer approval is required before the disease can be transformed into a mystery story.',
      },
    ],
    blockingIssues,
    warnings: [
      ...toStringArray(options.buildReport?.warnings),
      'Medical dossier review is required before story, panel, guide, render, eval, or export work can continue.',
    ],
    generatedAt: options.timestamp,
  };
}

/**
 * @param {{ workflowRun: any, canonicalDiseaseName: string, medicalDossier: any, buildReport: any, agentRunId: string, timestamp: string }} options
 * @returns {any}
 */
function buildMedicalDossierBuildReport(options) {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: createId('mdb'),
    tenantId: options.workflowRun.tenantId,
    workflowRunId: options.workflowRun.id,
    targetCanonicalDiseaseName: options.canonicalDiseaseName,
    medicalDossierId: options.medicalDossier.id,
    agentRunId: options.agentRunId,
    status: options.buildReport.status,
    sectionCoverage: {
      required: options.medicalDossier.completeness.requiredSectionCount,
      completed: options.medicalDossier.completeness.completedSectionCount,
    },
    claimCount: options.medicalDossier.claims.length,
    sourceCount: options.medicalDossier.sourceIds.length,
    blockingIssues: toStringArray(options.buildReport.blockingIssues),
    warnings: [
      ...toStringArray(options.buildReport.warnings),
      'Story generation is disabled until a local reviewer approves the medical dossier.',
    ],
    missingSections: options.medicalDossier.completeness.missingSections,
    traceabilityScore: options.medicalDossier.completeness.traceabilityScore,
    fitForStoryContinuation: false,
    generatedAt: options.timestamp,
  };
}

/**
 * @param {any} buildReport
 * @param {any} knowledgePack
 * @param {{ workflowRun: any, canonicalDiseaseName: string, timestamp: string }} options
 * @returns {any}
 */
function normalizeBuildReport(buildReport, knowledgePack, options) {
  const claimCount = Array.isArray(knowledgePack.evidence) ? knowledgePack.evidence.length : 0;
  const sourceCount = Array.isArray(knowledgePack.sourceCatalog) ? knowledgePack.sourceCatalog.length : 0;
  const blockingIssues = toStringArray(buildReport?.blockingIssues);
  const warnings = toStringArray(buildReport?.warnings);
  const fitForStoryContinuation = Boolean(buildReport?.fitForStoryContinuation ?? (claimCount > 0 && sourceCount > 0 && blockingIssues.length === 0));

  return {
    schemaVersion: SCHEMA_VERSION,
    id: createId('kbr'),
    tenantId: options.workflowRun.tenantId,
    workflowRunId: options.workflowRun.id,
    targetCanonicalDiseaseName: options.canonicalDiseaseName,
    status: normalizeBuildReportStatus(buildReport?.status, { blockingIssues, warnings }),
    claimCount,
    sourceCount,
    blockingIssues,
    warnings,
    missingEvidenceAreas: toStringArray(buildReport?.missingEvidenceAreas),
    fitForStoryContinuation,
    generatedAt: options.timestamp,
  };
}

/**
 * @param {{ workflowRun: any, workflowInput: any, canonicalDisease: any, researchBrief: any, sourceHarvest: any, knowledgePack: any, buildReport: any, responseSources?: any[], agentRunId?: string, agentSteps?: any[], stepSummaries?: Array<{ stepKey: string, agentName: string, outputSummary: string, findings: string[] }>, model: string, timestamp: string, allowedDomains: string[] }} options
 * @returns {any}
 */
function assembleResearchArtifacts(options) {
  const agentRunId = options.agentRunId ?? createId('arun');
  const stepSummaries = options.stepSummaries ?? RESEARCH_AGENT_DEFINITIONS.map(([stepKey, agentName]) => ({
    stepKey,
    agentName,
    outputSummary: `${agentName} was represented in the deterministic local assembly path.`,
    findings: ['No live specialist call was made in this path.'],
  }));
  const sourceDiscoveryReport = buildSourceDiscoveryReport({
    workflowRun: options.workflowRun,
    agentRunId,
    canonicalDiseaseName: options.knowledgePack.canonicalDiseaseName,
    sourceHarvest: options.sourceHarvest,
    allowedDomains: options.allowedDomains,
    timestamp: options.timestamp,
    gaps: options.buildReport.missingEvidenceAreas,
  });
  const medicalDossier = buildMedicalDossierFromKnowledgePack(options.knowledgePack, {
    workflowRun: options.workflowRun,
    agentRunId,
    sourceDiscoveryReportId: sourceDiscoveryReport.id,
    timestamp: options.timestamp,
  });
  const medicalDossierBuildReport = buildMedicalDossierBuildReport({
    workflowRun: options.workflowRun,
    canonicalDiseaseName: options.knowledgePack.canonicalDiseaseName,
    medicalDossier,
    buildReport: options.buildReport,
    agentRunId,
    timestamp: options.timestamp,
  });
  const medicalDossierQaReport = buildMedicalDossierQaReport({
    workflowRun: options.workflowRun,
    medicalDossier,
    knowledgePack: options.knowledgePack,
    buildReport: options.buildReport,
    agentRunId,
    timestamp: options.timestamp,
  });
  const agentSteps = (options.agentSteps ?? stepSummaries.map((stepSummary) => buildAgentStep({
    workflowRun: options.workflowRun,
    agentRunId,
    stepKey: stepSummary.stepKey,
    agentName: stepSummary.agentName,
    status: medicalDossierQaReport.status === 'failed' ? 'review-required' : 'succeeded',
    inputSummary: `Compile ${stepSummary.agentName} contribution for ${options.workflowInput.diseaseName}.`,
    outputSummary: stepSummary.outputSummary,
    findings: stepSummary.findings,
    artifactIds: [medicalDossier.id],
    timestamp: options.timestamp,
  })));
  const agentRun = buildAgentRun(agentSteps, {
    id: agentRunId,
    workflowRun: options.workflowRun,
    model: options.model,
    status: medicalDossierQaReport.status === 'failed' ? 'review-required' : 'review-required',
    startedAt: options.timestamp,
    endedAt: options.timestamp,
    producedArtifactIds: [
      sourceDiscoveryReport.id,
      medicalDossier.id,
      medicalDossierBuildReport.id,
      medicalDossierQaReport.id,
      options.knowledgePack.id,
    ],
  });

  return {
    researchBrief: options.researchBrief,
    sourceHarvest: options.sourceHarvest,
    sourceDiscoveryReport,
    knowledgePack: options.knowledgePack,
    buildReport: {
      ...options.buildReport,
      fitForStoryContinuation: false,
      warnings: uniqueStrings([
        ...toStringArray(options.buildReport.warnings),
        'Medical dossier review is required before story generation.',
      ]),
    },
    medicalDossier,
    medicalDossierBuildReport,
    medicalDossierQaReport,
    agentRun,
    agentSteps,
    responseSources: options.responseSources ?? [],
  };
}

/**
 * @param {string} promptJson
 * @returns {Record<string, unknown>}
 */
function parseJsonObject(promptJson) {
  let candidate = promptJson.trim();

  const fencedMatch = candidate.match(/```(?:json)?\s*([\s\S]*?)```/iu);

  if (fencedMatch?.[1]) {
    candidate = fencedMatch[1].trim();
  }

  if (!candidate.startsWith('{')) {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');

    if (start >= 0 && end > start) {
      candidate = candidate.slice(start, end + 1);
    }
  }

  const parsed = JSON.parse(candidate);

  if (!isRecord(parsed)) {
    throw new Error('Research assembly did not return a JSON object.');
  }

  return parsed;
}

/**
 * @param {string} diseaseName
 * @returns {string}
 */
function buildResearchPrompt(diseaseName) {
  return [
    'Return JSON only.',
    'Research the named disease using the configured file-search knowledge base and allowed web sources, then compile a medically cautious provisional disease knowledge pack and the source material needed for a high-yield medical dossier.',
    `Disease input: ${diseaseName}.`,
    'You must preserve medical traceability. Every clinically meaningful claim must map to a source catalog entry.',
    'Do not invent unsupported details. If evidence is weak, say so in buildReport.blockingIssues or buildReport.warnings.',
    'Cover these high-yield sections explicitly in the evidence and clinical summary: epidemiology, etiology, pathophysiology, clinical features, history, exam, labs, imaging, diagnostic criteria, differential diagnosis, treatment, management, complications, prognosis, teaching points, and visual anchors.',
    'Return an object with keys knowledgePack and buildReport.',
    'knowledgePack must include canonicalDiseaseName, aliases, ontologyId, diseaseCategory, educationalFocus, clinicalSummary, physiologyPrerequisites, pathophysiology, presentation, diagnostics, management, evidence, sourceCatalog, clinicalTeachingPoints, visualAnchors, and evidenceRelationships.',
    'Each sourceCatalog entry must include sourceLabel, sourceType, sourceTier, sourceUrl, governanceNotes, and reviewState.',
    'Each evidence entry must include claimText, sourceId, sourceLabel, sourceType, sourceLocator, confidence, claimType, certaintyLevel, diseaseStageApplicability, patientSubgroupApplicability, and importanceRank.',
    'buildReport must include status, fitForStoryContinuation, blockingIssues, warnings, and missingEvidenceAreas. buildReport.status must be one of ready, review-required, or blocked.',
    'Even if the draft is complete, fitForStoryContinuation must be false until the app records a local reviewer approval of the generated medical dossier.',
  ].join(' ');
}

/**
 * @param {string[]} allowedDomains
 * @param {string} knowledgeBaseVectorStoreId
 * @returns {any[]}
 */
function buildResearchTools(allowedDomains, knowledgeBaseVectorStoreId) {
  const tools = [];

  if (knowledgeBaseVectorStoreId) {
    tools.push({
      type: 'file_search',
      vector_store_ids: [knowledgeBaseVectorStoreId],
    });
  }

  if (allowedDomains.length > 0) {
    tools.push({
      type: 'web_search',
      filters: {
        allowed_domains: allowedDomains,
      },
      user_location: {
        type: 'approximate',
        country: 'US',
        timezone: 'America/New_York',
      },
    });
  }

  return tools;
}

/**
 * @param {string} knowledgeBaseVectorStoreId
 * @param {string[]} allowedDomains
 * @returns {string[]}
 */
function buildResearchIncludes(knowledgeBaseVectorStoreId, allowedDomains) {
  return [
    ...(allowedDomains.length > 0 ? ['web_search_call.action.sources'] : []),
    ...(knowledgeBaseVectorStoreId ? ['output[*].file_search_call.search_results'] : []),
  ];
}

/**
 * @param {{ allowedDomains: string[], knowledgeBaseVectorStoreId: string }} options
 * @returns {Promise<any[]>}
 */
async function buildAgentsSdkTools(options) {
  const { webSearchTool, fileSearchTool } = await import('@openai/agents');
  return [
    ...(options.knowledgeBaseVectorStoreId
      ? [fileSearchTool([options.knowledgeBaseVectorStoreId], {
        maxNumResults: 8,
        includeSearchResults: true,
      })]
      : []),
    ...(options.allowedDomains.length > 0
      ? [webSearchTool({
        filters: {
          allowedDomains: options.allowedDomains,
        },
        searchContextSize: 'high',
        userLocation: {
          type: 'approximate',
          country: 'US',
          timezone: 'America/New_York',
        },
      })]
      : []),
  ];
}

/**
 * @param {{ apiKey: string, model: string, allowedDomains: string[], knowledgeBaseVectorStoreId: string, diseaseName: string, canonicalDiseaseName: string }} options
 * @returns {Promise<{ parsed: Record<string, unknown>, stepSummaries: Array<{ stepKey: string, agentName: string, outputSummary: string, findings: string[] }> }>}
 */
async function runAgentsSdkResearchAssembly(options) {
  const {
    Agent,
    run,
    setDefaultOpenAIKey,
    setTracingDisabled,
  } = await import('@openai/agents');
  setDefaultOpenAIKey(options.apiKey);
  setTracingDisabled(process.env.OPENAI_AGENTS_DISABLE_TRACING !== 'false');

  const tools = await buildAgentsSdkTools({
    allowedDomains: options.allowedDomains,
    knowledgeBaseVectorStoreId: options.knowledgeBaseVectorStoreId,
  });
  const specialistSummaries = [];

  for (const [stepKey, agentName] of RESEARCH_AGENT_DEFINITIONS.slice(0, -2)) {
    const agent = new Agent({
      name: agentName,
      model: options.model,
      tools,
      modelSettings: {
        reasoning: { effort: 'low' },
        text: { verbosity: 'low' },
      },
      instructions: [
        'You are a medical education research specialist inside a local reviewer-gated pipeline.',
        'Use only reliable medical sources from the configured tools. Do not invent clinical facts.',
        'Return compact JSON only: {"findings":["..."],"warnings":["..."],"sourceNotes":["..."]}.',
        'Every finding should be high-yield and should name the clinical section it supports.',
      ].join(' '),
    });
    const result = await run(agent, [
      `Disease: ${options.diseaseName}.`,
      `Canonical target: ${options.canonicalDiseaseName}.`,
      `Specialist step: ${agentName}.`,
      'Find high-yield facts for the medical dossier. Preserve uncertainty and source needs.',
    ].join('\n'), {
      maxTurns: 4,
    });
    const outputText = String(result.finalOutput ?? '').trim();
    /** @type {Record<string, unknown>} */
    let outputJson = {};

    try {
      outputJson = parseJsonObject(outputText);
    } catch {
      outputJson = { findings: [outputText.slice(0, 800)], warnings: ['Specialist output required JSON normalization.'] };
    }

    specialistSummaries.push({
      stepKey,
      agentName,
      outputSummary: toStringArray(outputJson.findings).slice(0, 3).join(' ') || outputText.slice(0, 240),
      findings: [
        ...toStringArray(outputJson.findings),
        ...toStringArray(outputJson.warnings),
      ].slice(0, 8),
    });
  }

  const synthesisAgent = new Agent({
    name: 'Evidence Synthesis Agent',
    model: options.model,
    tools,
    modelSettings: {
      reasoning: { effort: 'medium' },
      text: { verbosity: 'medium' },
    },
    instructions: [
      'You compile source-traceable medical education dossiers for a comic mystery pipeline.',
      'Return JSON only with keys knowledgePack and buildReport.',
      'knowledgePack must include canonicalDiseaseName, aliases, ontologyId, diseaseCategory, educationalFocus, clinicalSummary, physiologyPrerequisites, pathophysiology, presentation, diagnostics, management, evidence, sourceCatalog, clinicalTeachingPoints, visualAnchors, and evidenceRelationships.',
      'Every evidence claim must link to a sourceCatalog id. Make claims specific enough for story, panel, and render planning.',
      'Cover epidemiology, etiology, pathophysiology, clinical features, history, exam, labs, imaging, diagnostic criteria, differential diagnosis, treatment, management, complications, prognosis, teaching points, and visual anchors.',
      'buildReport.status must be ready, review-required, or blocked. buildReport.fitForStoryContinuation must be false until reviewer approval.',
    ].join(' '),
  });
  const synthesisResult = await run(synthesisAgent, [
    buildResearchPrompt(options.diseaseName),
    'Specialist summaries:',
    JSON.stringify(specialistSummaries, null, 2),
  ].join('\n'), {
    maxTurns: 6,
  });
  const synthesisText = String(synthesisResult.finalOutput ?? '').trim();
  const parsed = parseJsonObject(synthesisText);

  specialistSummaries.push({
    stepKey: 'evidence-synthesis',
    agentName: 'Evidence Synthesis Agent',
    outputSummary: 'Compiled the normalized disease knowledge pack draft and dossier inputs.',
    findings: ['Generated source-linked knowledge pack JSON for deterministic dossier compilation.'],
  });
  specialistSummaries.push({
    stepKey: 'medical-dossier-qa',
    agentName: 'Medical Dossier QA Agent',
    outputSummary: 'Deterministic dossier QA runs after schema normalization and before reviewer approval.',
    findings: ['The app will block story generation until the dossier is reviewed locally.'],
  });

  return {
    parsed,
    stepSummaries: specialistSummaries,
  };
}

/**
 * @param {string} model
 * @param {any[]} tools
 * @param {string[]} includes
 * @param {string} input
 * @returns {Record<string, unknown>}
 */
function buildResponsesRequestBody(model, tools, includes, input) {
  const usesWebSearch = tools.some((tool) => tool?.type === 'web_search');
  const body = {
    model,
    reasoning: {
      effort: 'low',
    },
    tools,
    tool_choice: 'auto',
    include: includes,
    input,
  };

  if (!usesWebSearch) {
    return {
      ...body,
      text: {
        format: {
          type: 'json_object',
        },
      },
    };
  }

  return body;
}

/**
 * @param {{ apiKey: string, fetchImpl: typeof fetch, model: string, diseaseName: string, originalText: string }} options
 * @returns {Promise<Record<string, unknown>>}
 */
async function repairResearchJson(options) {
  const response = await options.fetchImpl('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${options.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: options.model,
      reasoning: {
        effort: 'low',
      },
      text: {
        format: {
          type: 'json_object',
        },
      },
      input: [
        'Repair the following provisional disease research draft into valid JSON only.',
        `Disease input: ${options.diseaseName}.`,
        'Return exactly one object with keys knowledgePack and buildReport.',
        'Do not add new medical facts. Preserve the claims, sources, caveats, and review warnings already present in the draft.',
        'buildReport.status must be one of ready, review-required, or blocked.',
        'Draft:',
        options.originalText.slice(0, 24000),
      ].join('\n'),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Research assembly JSON repair failed: ${response.status} ${response.statusText}. ${text}`);
  }

  const payload = await response.json();
  return parseJsonObject(extractOutputText(payload));
}

/**
 * @param {any} compiled
 * @param {{ workflowRun: any, workflowInput: any, canonicalDisease: any }} options
 * @param {{ model: string, allowedDomains: string[] }} context
 * @returns {any}
 */
export function normalizeCompiledResearchAssembly(compiled, options, context) {
  if (compiled?.medicalDossier && compiled?.medicalDossierBuildReport && compiled?.medicalDossierQaReport && compiled?.agentRun) {
    return {
      ...compiled,
      buildReport: {
        ...compiled.buildReport,
        fitForStoryContinuation: false,
      },
    };
  }

  const timestamp = compiled?.buildReport?.generatedAt ?? compiled?.knowledgePack?.generatedAt ?? new Date().toISOString();
  const canonicalDiseaseName = compiled?.knowledgePack?.canonicalDiseaseName
    ?? options.canonicalDisease.canonicalDiseaseName
    ?? toCanonicalDiseaseLabel(options.workflowInput.diseaseName);
  const knowledgePack = normalizeKnowledgePack(compiled?.knowledgePack ?? {}, {
    canonicalDiseaseName,
    workflowRunId: options.workflowRun.id,
    timestamp,
  });
  const sourceHarvest = compiled?.sourceHarvest ?? buildSourceHarvest(compiled?.responseSources ?? [], knowledgePack, {
    workflowRun: options.workflowRun,
    canonicalDiseaseName: knowledgePack.canonicalDiseaseName,
    timestamp,
  });
  const buildReport = normalizeBuildReport(compiled?.buildReport ?? {}, knowledgePack, {
    workflowRun: options.workflowRun,
    canonicalDiseaseName: knowledgePack.canonicalDiseaseName,
    timestamp,
  });
  const researchBrief = compiled?.researchBrief ?? buildResearchBrief({
    workflowRun: options.workflowRun,
    workflowInput: options.workflowInput,
    canonicalDisease: options.canonicalDisease,
    allowedDomains: context.allowedDomains,
  });

  return assembleResearchArtifacts({
    workflowRun: options.workflowRun,
    workflowInput: options.workflowInput,
    canonicalDisease: options.canonicalDisease,
    researchBrief,
    sourceHarvest,
    knowledgePack,
    buildReport,
    model: context.model,
    timestamp,
    allowedDomains: context.allowedDomains,
    responseSources: compiled?.responseSources ?? [],
  });
}

/**
 * @param {{ workflowRun: any, workflowInput: any, canonicalDisease: any }} options
 * @returns {any}
 */
function compileLocalFixtureKnowledgePack(options) {
  const timestamp = new Date().toISOString();
  const canonicalDiseaseName = options.canonicalDisease.canonicalDiseaseName ?? toCanonicalDiseaseLabel(options.workflowInput.diseaseName);
  const diseaseSlug = normalizeId(canonicalDiseaseName);
  const sourceId = `src.${diseaseSlug}.local-fixture`;
  const sourceLabel = `Local no-key provisional scaffold for ${canonicalDiseaseName}`;
  const researchBrief = buildResearchBrief({
    workflowRun: options.workflowRun,
    workflowInput: options.workflowInput,
    canonicalDisease: options.canonicalDisease,
    allowedDomains: [],
  });
  researchBrief.researchIntent = 'Compile a local no-key provisional scaffold only. This fixture does not perform live medical research and must remain reviewer-gated.';
  researchBrief.allowedDomains = [];
  const sourceHarvest = {
    schemaVersion: SCHEMA_VERSION,
    id: createId('shr'),
    tenantId: options.workflowRun.tenantId,
    workflowRunId: options.workflowRun.id,
    targetCanonicalDiseaseName: canonicalDiseaseName,
    sources: [
      {
        sourceId,
        sourceLabel,
        sourceType: 'reference',
        origin: 'local-fixture',
        sourceUrl: `local-fixture://open-disease/${diseaseSlug}`,
        retrievedAt: timestamp,
        captureMethod: 'local-no-api-fixture',
        status: 'provisional-scaffold',
      },
    ],
    droppedSources: [],
    generatedAt: timestamp,
  };
  const knowledgePack = {
    schemaVersion: SCHEMA_VERSION,
    id: `kp.${diseaseSlug}.${normalizeId(options.workflowRun.id)}`,
    canonicalDiseaseName,
    packStatus: 'provisional',
    packScope: 'run',
    generationMode: 'local-fixture',
    derivedFromRunId: options.workflowRun.id,
    sourceOrigins: {
      seeded: 0,
      'user-doc': 0,
      'agent-web': 0,
      'local-fixture': 1,
    },
    aliases: [options.workflowInput.diseaseName, canonicalDiseaseName],
    ontologyId: `prov:${diseaseSlug}`,
    diseaseCategory: 'provisional-research-needed',
    educationalFocus: [
      'reviewer-gated evidence traceability',
      'condition-specific source governance before release',
    ],
    clinicalSummary: {
      oneSentence: `${canonicalDiseaseName} has not been researched in this local no-key run, so the generated package is a provisional scaffold for reviewer completion.`,
      patientExperienceSummary: 'Patient-facing details must be authored from approved sources before publication.',
      keyMechanism: 'Mechanism, diagnostics, and treatment remain reviewer-gated until source-backed claims are added or approved.',
      timeScale: 'requires source-backed review',
    },
    physiologyPrerequisites: [
      {
        topic: 'Evidence governance',
        whyItMatters: 'The story may only make disease-specific medical claims after reviewer-approved source support exists.',
      },
    ],
    pathophysiology: [
      {
        order: 1,
        event: 'local scaffold created without live research',
        mechanism: 'The app preserves workflow structure while preventing unverified disease-specific claims from being treated as final.',
        scale: 'whole-body',
        linkedClaimIds: [`clm.${diseaseSlug}.001`],
      },
    ],
    presentation: {
      hallmarkSymptoms: ['source-backed symptom pattern pending reviewer completion'],
      historyClues: ['condition-specific history clues require approved evidence'],
      examFindings: ['condition-specific exam findings require approved evidence'],
      redFlags: ['do not publish without clinical source approval'],
      typicalTimecourse: 'pending evidence review',
    },
    diagnostics: {
      firstLineTests: ['evidence-backed diagnostic workup pending reviewer completion'],
      confirmatoryTests: ['condition-specific confirmation requires approved sources'],
      diagnosticLogic: ['Do not infer diagnostic logic from the disease name alone. Reviewers must add or approve source-backed claims.'],
    },
    management: {
      stabilization: ['avoid disease-specific treatment claims until source governance approval'],
      diseaseDirectedCare: ['reviewer-authored treatment plan pending approved evidence'],
      monitoring: ['track provisional status, source freshness, and contradiction review before release'],
      notes: ['This local fixture exists to exercise workflow, review, render, eval, and export gates without an API key.'],
    },
    evidence: [
      {
        claimId: `clm.${diseaseSlug}.001`,
        claimText: `${canonicalDiseaseName} requires reviewer-approved condition-specific evidence before publication-ready medical claims can be made.`,
        sourceId,
        sourceLabel,
        sourceType: 'reference',
        sourceLocator: 'local fixture governance scaffold',
        confidence: 0.5,
        claimType: 'governance',
        certaintyLevel: 'guarded',
        diseaseStageApplicability: 'all stages pending review',
        patientSubgroupApplicability: 'general pending review',
        importanceRank: 1,
      },
      {
        claimId: `clm.${diseaseSlug}.002`,
        claimText: `Mechanism, diagnostic, and treatment details for ${canonicalDiseaseName} are provisional until tied to approved source records.`,
        sourceId,
        sourceLabel,
        sourceType: 'reference',
        sourceLocator: 'local fixture traceability scaffold',
        confidence: 0.5,
        claimType: 'traceability',
        certaintyLevel: 'guarded',
        diseaseStageApplicability: 'all stages pending review',
        patientSubgroupApplicability: 'general pending review',
        importanceRank: 2,
      },
    ],
    sourceCatalog: [
      {
        id: sourceId,
        canonicalDiseaseName,
        sourceLabel,
        sourceType: 'reference',
        sourceTier: 'tenant-pack',
        origin: 'local-fixture',
        retrievedAt: timestamp,
        captureMethod: 'local-no-api-fixture',
        reviewState: 'promotion-required',
        defaultApprovalStatus: 'conditional',
        owner: 'clinical-governance',
        primaryOwnerRole: 'Clinical Reviewer',
        backupOwnerRole: 'Product Editor',
        refreshCadenceDays: 30,
        governanceNotes: [
          'Local fixture only. Replace or approve with real source-backed evidence before publication.',
        ],
        topics: ['local scaffold', 'source governance'],
        sourceUrl: `local-fixture://open-disease/${diseaseSlug}`,
        lastReviewedAt: timestamp,
      },
    ],
    clinicalTeachingPoints: [
      {
        order: 1,
        title: 'Provisional evidence gate',
        teachingPoint: 'A local no-key run can exercise workflow structure, but publishable disease teaching requires approved source-backed claims.',
        linkedClaimIds: [`clm.${diseaseSlug}.001`],
      },
    ],
    visualAnchors: [
      {
        anchorId: `vanchor.${diseaseSlug}.001`,
        title: 'Evidence review checkpoint',
        bodyScale: 'story',
        location: 'case board',
        description: 'Show the detectives pausing at a glowing evidence board with empty slots reserved for approved clinical sources.',
        linkedClaimIds: [`clm.${diseaseSlug}.001`, `clm.${diseaseSlug}.002`],
      },
    ],
    evidenceRelationships: [
      {
        fromClaimId: `clm.${diseaseSlug}.001`,
        toClaimId: `clm.${diseaseSlug}.002`,
        relationshipType: 'supports',
        status: 'monitor',
        notes: 'Both scaffold claims reinforce that this run is structurally valid but medically provisional.',
      },
    ],
    generatedAt: timestamp,
    generatedBy: 'local-fixture-research-assembly',
  };
  const buildReport = normalizeBuildReport({
    status: 'review-required',
    fitForStoryContinuation: false,
    blockingIssues: [
      'Local fixture mode did not perform live medical research and cannot proceed to story generation without reviewer-approved dossier completion.',
    ],
    warnings: [
      'No OpenAI API key was configured, so no live medical research was performed.',
      'This provisional pack is suitable for local workflow testing only until reviewer-approved evidence is added or accepted.',
    ],
    missingEvidenceAreas: [
      'condition-specific mechanism',
      'condition-specific presentation',
      'condition-specific diagnostics',
      'condition-specific treatment',
    ],
  }, knowledgePack, {
    workflowRun: options.workflowRun,
    canonicalDiseaseName,
    timestamp,
  });

  return assembleResearchArtifacts({
    workflowRun: options.workflowRun,
    workflowInput: options.workflowInput,
    canonicalDisease: options.canonicalDisease,
    researchBrief,
    sourceHarvest,
    knowledgePack,
    buildReport,
    model: 'local-fixture',
    timestamp,
    allowedDomains: [],
    responseSources: [],
  });
}

export class ResearchAssemblyService {
  /**
   * @param {{ apiKey?: string, fetchImpl?: typeof fetch, model?: string, allowedDomains?: string[], knowledgeBaseVectorStoreId?: string, compiler?: Function }} [options]
   */
  constructor(options = {}) {
    this.apiKey = options.apiKey ?? process.env.OPENAI_API_KEY ?? '';
    this.hasCustomFetchImpl = typeof options.fetchImpl === 'function';
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.model = options.model ?? readNonEmptyEnv(process.env.OPENAI_RESEARCH_MODEL) ?? readNonEmptyEnv(process.env.MMS_MODEL) ?? 'gpt-5.2';
    this.allowedDomains = options.allowedDomains ?? DEFAULT_ALLOWED_DOMAINS;
    this.knowledgeBaseVectorStoreId = options.knowledgeBaseVectorStoreId ?? readNonEmptyEnv(process.env.KB_VECTOR_STORE_ID) ?? '';
    this.compiler = options.compiler;
  }

  /**
   * @param {{ workflowRun: any, workflowInput: any, canonicalDisease: any, actor?: any }} options
   * @returns {Promise<any>}
   */
  async compileProvisionalKnowledgePack(options) {
    if (typeof this.compiler === 'function') {
      const compiled = await this.compiler(options);
      return normalizeCompiledResearchAssembly(compiled, options, {
        model: this.model,
        allowedDomains: [...this.allowedDomains],
      });
    }

    if (!this.apiKey) {
      return compileLocalFixtureKnowledgePack(options);
    }

    const researchBrief = buildResearchBrief({
      workflowRun: options.workflowRun,
      workflowInput: options.workflowInput,
      canonicalDisease: options.canonicalDisease,
      allowedDomains: [...this.allowedDomains],
      knowledgeBaseVectorStoreId: this.knowledgeBaseVectorStoreId,
    });
    const timestamp = new Date().toISOString();
    let parsed;
    let stepSummaries;
    let responseSources = [];

    if (!this.hasCustomFetchImpl) {
      const agentResult = await runAgentsSdkResearchAssembly({
        apiKey: this.apiKey,
        model: this.model,
        allowedDomains: [...this.allowedDomains],
        knowledgeBaseVectorStoreId: this.knowledgeBaseVectorStoreId,
        diseaseName: options.workflowInput.diseaseName,
        canonicalDiseaseName: options.canonicalDisease.canonicalDiseaseName ?? toCanonicalDiseaseLabel(options.workflowInput.diseaseName),
      });
      parsed = agentResult.parsed;
      stepSummaries = agentResult.stepSummaries;
    } else {
      const tools = buildResearchTools([...this.allowedDomains], this.knowledgeBaseVectorStoreId);
      const input = buildResearchPrompt(options.workflowInput.diseaseName);
      const response = await this.fetchImpl('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(buildResponsesRequestBody(
          this.model,
          tools,
          buildResearchIncludes(this.knowledgeBaseVectorStoreId, [...this.allowedDomains]),
          input,
        )),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Research assembly request failed: ${response.status} ${response.statusText}. ${text}`);
      }

      const payload = await response.json();
      const outputText = extractOutputText(payload);
      responseSources = collectResponseSources(payload);

      try {
        parsed = parseJsonObject(outputText);
      } catch (error) {
        parsed = await repairResearchJson({
          apiKey: this.apiKey,
          fetchImpl: this.fetchImpl,
          model: this.model,
          diseaseName: options.workflowInput.diseaseName,
          originalText: outputText,
        });
      }
    }
    const knowledgePack = normalizeKnowledgePack(parsed.knowledgePack, {
      canonicalDiseaseName: options.canonicalDisease.canonicalDiseaseName ?? toCanonicalDiseaseLabel(options.workflowInput.diseaseName),
      workflowRunId: options.workflowRun.id,
      timestamp,
    });
    const sourceHarvest = buildSourceHarvest(responseSources, knowledgePack, {
      workflowRun: options.workflowRun,
      canonicalDiseaseName: knowledgePack.canonicalDiseaseName,
      timestamp,
    });
    const buildReport = normalizeBuildReport(parsed.buildReport, knowledgePack, {
      workflowRun: options.workflowRun,
      canonicalDiseaseName: knowledgePack.canonicalDiseaseName,
      timestamp,
    });

    return assembleResearchArtifacts({
      workflowRun: options.workflowRun,
      workflowInput: options.workflowInput,
      canonicalDisease: options.canonicalDisease,
      researchBrief,
      sourceHarvest,
      knowledgePack,
      buildReport,
      model: this.model,
      timestamp,
      allowedDomains: [...this.allowedDomains],
      stepSummaries,
      responseSources,
    });
  }
}

/**
 * @param {{ apiKey?: string, fetchImpl?: typeof fetch, model?: string, allowedDomains?: string[], knowledgeBaseVectorStoreId?: string, compiler?: Function }} [options]
 */
export function createResearchAssemblyService(options = {}) {
  return new ResearchAssemblyService(options);
}
