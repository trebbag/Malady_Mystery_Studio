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
 * @param {any} draft
 * @param {{ canonicalDiseaseName: string, workflowRunId: string, timestamp: string }} options
 * @returns {any}
 */
function normalizeKnowledgePack(draft, options) {
  const diseaseSlug = normalizeId(options.canonicalDiseaseName);
  const evidence = toObjectArray(draft?.evidence).map((record, index) => ({
    claimId: record.claimId ?? `clm.${diseaseSlug}.${String(index + 1).padStart(3, '0')}`,
    claimText: String(record.claimText ?? ''),
    sourceId: record.sourceId ?? `src.${diseaseSlug}.${String(index + 1).padStart(3, '0')}`,
    sourceType: normalizeSourceType(record),
    sourceLabel: String(record.sourceLabel ?? ''),
    sourceLocator: String(record.sourceLocator ?? record.sourceUrl ?? ''),
    confidence: Number(record.confidence ?? 0.8),
    ...(typeof record.lastReviewedAt === 'string' ? { lastReviewedAt: record.lastReviewedAt } : {}),
    ...(typeof record.applicability === 'string' ? { applicability: record.applicability } : {}),
    ...(typeof record.claimType === 'string' ? { claimType: record.claimType } : {}),
    ...(typeof record.certaintyLevel === 'string' ? { certaintyLevel: record.certaintyLevel } : {}),
    ...(typeof record.diseaseStageApplicability === 'string' ? { diseaseStageApplicability: record.diseaseStageApplicability } : {}),
    ...(typeof record.patientSubgroupApplicability === 'string' ? { patientSubgroupApplicability: record.patientSubgroupApplicability } : {}),
    ...(Number.isInteger(record.importanceRank) ? { importanceRank: record.importanceRank } : {}),
  }));
  const sourceCatalog = toObjectArray(draft?.sourceCatalog).map((entry, index) => ({
    id: entry.id ?? `src.${diseaseSlug}.${String(index + 1).padStart(3, '0')}`,
    canonicalDiseaseName: options.canonicalDiseaseName,
    sourceLabel: String(entry.sourceLabel ?? entry.title ?? ''),
    sourceType: normalizeSourceType(entry),
    sourceTier: String(entry.sourceTier ?? 'tenant-pack'),
    origin: String(entry.origin ?? 'agent-web'),
    retrievedAt: typeof entry.retrievedAt === 'string' ? entry.retrievedAt : options.timestamp,
    captureMethod: String(entry.captureMethod ?? 'responses-web-search'),
    reviewState: String(entry.reviewState ?? 'provisional'),
    defaultApprovalStatus: String(entry.defaultApprovalStatus ?? 'conditional'),
    owner: String(entry.owner ?? 'clinical-governance'),
    primaryOwnerRole: String(entry.primaryOwnerRole ?? 'Clinical Reviewer'),
    backupOwnerRole: String(entry.backupOwnerRole ?? 'Product Editor'),
    refreshCadenceDays: Number.isInteger(entry.refreshCadenceDays) ? entry.refreshCadenceDays : 180,
    governanceNotes: toStringArray(entry.governanceNotes),
    topics: toStringArray(entry.topics),
    ...(typeof entry.sourceUrl === 'string' ? { sourceUrl: entry.sourceUrl } : {}),
    lastReviewedAt: typeof entry.lastReviewedAt === 'string' ? entry.lastReviewedAt : options.timestamp,
  }));

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
    educationalFocus: toStringArray(draft?.educationalFocus),
    clinicalSummary: isRecord(draft?.clinicalSummary) ? draft.clinicalSummary : {},
    physiologyPrerequisites: toObjectArray(draft?.physiologyPrerequisites),
    pathophysiology: toObjectArray(draft?.pathophysiology),
    presentation: isRecord(draft?.presentation) ? draft.presentation : {},
    diagnostics: isRecord(draft?.diagnostics) ? draft.diagnostics : {},
    management: isRecord(draft?.management) ? draft.management : {},
    evidence,
    sourceCatalog,
    clinicalTeachingPoints: toObjectArray(draft?.clinicalTeachingPoints),
    visualAnchors: toObjectArray(draft?.visualAnchors),
    evidenceRelationships: toObjectArray(draft?.evidenceRelationships).map((relationship) => ({
      fromClaimId: String(relationship.fromClaimId ?? ''),
      toClaimId: String(relationship.toClaimId ?? ''),
      relationshipType: String(relationship.relationshipType ?? 'supports'),
      status: String(relationship.status ?? 'open'),
      ...(typeof relationship.notes === 'string' ? { notes: relationship.notes } : {}),
    })),
    generatedAt: options.timestamp,
    generatedBy: 'research-assembly-agent',
  };
}

/**
 * @param {{ workflowRun: any, workflowInput: any, canonicalDisease: any, allowedDomains: string[] }} options
 * @returns {any}
 */
function buildResearchBrief(options) {
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
    status: String(buildReport?.status ?? (blockingIssues.length > 0 ? 'blocked' : (warnings.length > 0 ? 'review-required' : 'ready'))),
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
  const parsed = JSON.parse(promptJson);

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
    'Research the named disease using allowed web sources and compile a medically cautious provisional disease knowledge pack.',
    `Disease input: ${diseaseName}.`,
    'You must preserve medical traceability. Every clinically meaningful claim must map to a source catalog entry.',
    'Do not invent unsupported details. If evidence is weak, say so in buildReport.blockingIssues or buildReport.warnings.',
    'Return an object with keys knowledgePack and buildReport.',
    'knowledgePack must include canonicalDiseaseName, aliases, ontologyId, diseaseCategory, educationalFocus, clinicalSummary, physiologyPrerequisites, pathophysiology, presentation, diagnostics, management, evidence, sourceCatalog, clinicalTeachingPoints, visualAnchors, and evidenceRelationships.',
    'Each sourceCatalog entry must include sourceLabel, sourceType, sourceTier, sourceUrl, governanceNotes, and reviewState.',
    'Each evidence entry must include claimText, sourceId, sourceLabel, sourceType, sourceLocator, confidence, claimType, certaintyLevel, diseaseStageApplicability, patientSubgroupApplicability, and importanceRank.',
    'buildReport must include status, fitForStoryContinuation, blockingIssues, warnings, and missingEvidenceAreas.',
  ].join(' ');
}

export class ResearchAssemblyService {
  /**
   * @param {{ apiKey?: string, fetchImpl?: typeof fetch, model?: string, allowedDomains?: string[], compiler?: Function }} [options]
   */
  constructor(options = {}) {
    this.apiKey = options.apiKey ?? process.env.OPENAI_API_KEY ?? '';
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.model = options.model ?? process.env.OPENAI_RESEARCH_MODEL ?? 'gpt-5';
    this.allowedDomains = options.allowedDomains ?? DEFAULT_ALLOWED_DOMAINS;
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
      throw new Error('Open disease research assembly requires OPENAI_API_KEY.');
    }

    const researchBrief = buildResearchBrief({
      workflowRun: options.workflowRun,
      workflowInput: options.workflowInput,
      canonicalDisease: options.canonicalDisease,
      allowedDomains: [...this.allowedDomains],
    });
    const timestamp = new Date().toISOString();
    const response = await this.fetchImpl('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        reasoning: {
          effort: 'low',
        },
        tools: [
          {
            type: 'web_search',
            filters: {
              allowed_domains: this.allowedDomains,
            },
            user_location: {
              type: 'approximate',
              country: 'US',
              timezone: 'America/New_York',
            },
          },
        ],
        tool_choice: 'auto',
        include: ['web_search_call.action.sources'],
        text: {
          format: {
            type: 'json_object',
          },
        },
        input: buildResearchPrompt(options.workflowInput.diseaseName),
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Research assembly request failed: ${response.status} ${response.statusText}. ${text}`);
    }

    const payload = await response.json();
    const parsed = parseJsonObject(extractOutputText(payload));
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
 * @param {{ apiKey?: string, fetchImpl?: typeof fetch, model?: string, allowedDomains?: string[], compiler?: Function }} [options]
 */
export function createResearchAssemblyService(options = {}) {
  return new ResearchAssemblyService(options);
}
