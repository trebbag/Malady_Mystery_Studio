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
    'Research the named disease using the configured file-search knowledge base and allowed web sources, then compile a medically cautious provisional disease knowledge pack.',
    `Disease input: ${diseaseName}.`,
    'You must preserve medical traceability. Every clinically meaningful claim must map to a source catalog entry.',
    'Do not invent unsupported details. If evidence is weak, say so in buildReport.blockingIssues or buildReport.warnings.',
    'Return an object with keys knowledgePack and buildReport.',
    'knowledgePack must include canonicalDiseaseName, aliases, ontologyId, diseaseCategory, educationalFocus, clinicalSummary, physiologyPrerequisites, pathophysiology, presentation, diagnostics, management, evidence, sourceCatalog, clinicalTeachingPoints, visualAnchors, and evidenceRelationships.',
    'Each sourceCatalog entry must include sourceLabel, sourceType, sourceTier, sourceUrl, governanceNotes, and reviewState.',
    'Each evidence entry must include claimText, sourceId, sourceLabel, sourceType, sourceLocator, confidence, claimType, certaintyLevel, diseaseStageApplicability, patientSubgroupApplicability, and importanceRank.',
    'buildReport must include status, fitForStoryContinuation, blockingIssues, warnings, and missingEvidenceAreas. buildReport.status must be one of ready, review-required, or blocked.',
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
    fitForStoryContinuation: true,
    blockingIssues: [],
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

  return {
    researchBrief,
    sourceHarvest,
    knowledgePack,
    buildReport,
    responseSources: [],
  };
}

export class ResearchAssemblyService {
  /**
   * @param {{ apiKey?: string, fetchImpl?: typeof fetch, model?: string, allowedDomains?: string[], knowledgeBaseVectorStoreId?: string, compiler?: Function }} [options]
   */
  constructor(options = {}) {
    this.apiKey = options.apiKey ?? process.env.OPENAI_API_KEY ?? '';
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
      return this.compiler(options);
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
    let parsed;

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
    const knowledgePack = normalizeKnowledgePack(parsed.knowledgePack, {
      canonicalDiseaseName: options.canonicalDisease.canonicalDiseaseName ?? toCanonicalDiseaseLabel(options.workflowInput.diseaseName),
      workflowRunId: options.workflowRun.id,
      timestamp,
    });
    const responseSources = collectResponseSources(payload);
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

    return {
      researchBrief,
      sourceHarvest,
      knowledgePack,
      buildReport,
      responseSources,
    };
  }
}

/**
 * @param {{ apiKey?: string, fetchImpl?: typeof fetch, model?: string, allowedDomains?: string[], knowledgeBaseVectorStoreId?: string, compiler?: Function }} [options]
 */
export function createResearchAssemblyService(options = {}) {
  return new ResearchAssemblyService(options);
}
