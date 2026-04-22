import { readFileSync } from 'node:fs';
import path from 'node:path';

import YAML from 'yaml';

import { createId } from '../../../packages/shared-config/src/ids.mjs';
import { findRepoRoot } from '../../../packages/shared-config/src/repo-paths.mjs';
import {
  reviewEducationalSequencing,
  reviewMysteryIntegrity,
  reviewPanelPlans,
  reviewRenderPrompts,
  reviewSceneCards,
} from '../../story-engine/src/service.mjs';

const SCHEMA_VERSION = '1.0.0';
const VIRTUAL_RELEASE_ARTIFACT_TYPES = new Set(['release-bundle', 'release-bundle-index', 'source-evidence-pack']);

/**
 * @param {number} value
 * @returns {number}
 */
function roundScore(value) {
  return Number(Math.max(0, Math.min(1, value)).toFixed(3));
}

/**
 * @param {string | undefined | null} value
 * @returns {string}
 */
function normalizeName(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/**
 * @param {string} contents
 * @returns {any[]}
 */
function parseJsonLines(contents) {
  return contents
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

/**
 * @param {any[]} qaReports
 * @returns {any | null}
 */
function selectPrimaryQaReport(qaReports) {
  return qaReports.find((qaReport) => qaReport.subjectType === 'workflow-run')
    ?? qaReports.at(-1)
    ?? null;
}

/**
 * @param {string} artifactType
 * @returns {boolean}
 */
function isRelevantArtifactType(artifactType) {
  return artifactType !== 'project' && artifactType !== 'eval-run' && artifactType !== 'release-bundle';
}

/**
 * @param {any} workflowRun
 * @param {string} artifactType
 * @returns {any[]}
 */
function listArtifactReferencesByType(workflowRun, artifactType) {
  return workflowRun.artifacts.filter((artifact) => artifact.artifactType === artifactType);
}

/**
 * @param {import('./store.mjs').PlatformStore} store
 * @param {any} workflowRun
 * @param {string} artifactType
 * @returns {any[]}
 */
function loadArtifactsByType(store, workflowRun, artifactType) {
  return listArtifactReferencesByType(workflowRun, artifactType)
    .map((artifactReference) => store.getArtifact(artifactType, artifactReference.artifactId))
    .filter(Boolean);
}

/**
 * @param {import('./store.mjs').PlatformStore} store
 * @param {any} workflowRun
 * @param {string} artifactType
 * @returns {any | null}
 */
function loadLatestArtifactByType(store, workflowRun, artifactType) {
  return loadArtifactsByType(store, workflowRun, artifactType).at(-1) ?? null;
}

/**
 * @param {import('./store.mjs').PlatformStore} store
 * @param {any} workflowRun
 * @returns {Array<{ artifactType: string, artifactId: string, location: string, checksum: string, contentType: string, retentionClass: string }>}
 */
function collectReleaseArtifactManifest(store, workflowRun) {
  return workflowRun.artifacts
    .filter((artifactReference) => artifactReference.artifactType !== 'project')
    .map((artifactReference) => {
      const artifactMetadata = store.getArtifactMetadata(artifactReference.artifactType, artifactReference.artifactId);

      if (!artifactMetadata) {
        throw new Error(`Artifact metadata missing for ${artifactReference.artifactType}:${artifactReference.artifactId}.`);
      }

      return {
        artifactType: artifactMetadata.artifactType,
        artifactId: artifactMetadata.artifactId,
        location: artifactMetadata.location,
        checksum: artifactMetadata.checksum,
        contentType: artifactMetadata.contentType,
        retentionClass: artifactMetadata.retentionClass,
      };
    });
}

/**
 * @param {import('./store.mjs').PlatformStore} store
 * @param {any} workflowRun
 * @returns {string}
 */
export function getLatestRelevantArtifactAt(store, workflowRun) {
  const artifactTimestamps = workflowRun.artifacts
    .filter((artifactReference) => isRelevantArtifactType(artifactReference.artifactType))
    .map((artifactReference) => store.getArtifactMetadata(artifactReference.artifactType, artifactReference.artifactId))
    .filter(Boolean)
    .map((artifactMetadata) => artifactMetadata.createdAt);

  return artifactTimestamps.sort().at(-1) ?? workflowRun.updatedAt;
}

/**
 * @param {any} evalRun
 * @param {import('./store.mjs').PlatformStore} store
 * @param {any} workflowRun
 * @returns {'missing' | 'stale' | 'failed' | 'passed'}
 */
export function deriveEvalStatus(evalRun, store, workflowRun) {
  if (!evalRun) {
    return 'missing';
  }

  if (new Date(evalRun.evaluatedAt).getTime() < new Date(getLatestRelevantArtifactAt(store, workflowRun)).getTime()) {
    return 'stale';
  }

  return evalRun.summary.allThresholdsMet ? 'passed' : 'failed';
}

/**
 * @param {any} workflowRun
 * @returns {any[]}
 */
export function listEvaluationReferences(workflowRun) {
  return workflowRun.artifacts.filter((artifactReference) => artifactReference.artifactType === 'eval-run');
}

/**
 * @param {string} artifactType
 * @param {any} context
 * @returns {boolean}
 */
function artifactIsAvailable(artifactType, context) {
  if (VIRTUAL_RELEASE_ARTIFACT_TYPES.has(artifactType)) {
    return Boolean(context.project && context.diseasePacket);
  }

  return context.availableArtifactTypes.has(artifactType);
}

/**
 * @param {any} evaluationCase
 * @param {any} context
 * @returns {boolean}
 */
export function isCaseApplicable(evaluationCase, context) {
  const caseDisease = normalizeName(evaluationCase.input?.disease);

  if (caseDisease && caseDisease !== context.canonicalDiseaseName) {
    return false;
  }

  return true;
}

/**
 * @param {any} diseasePacket
 * @returns {number}
 */
function scoreMedicalPacket(diseasePacket) {
  if (!diseasePacket) {
    return 0;
  }

  let score = 1;
  const evidenceCount = Array.isArray(diseasePacket.evidence) ? diseasePacket.evidence.length : 0;
  const approvedEvidenceCount = Array.isArray(diseasePacket.evidence)
    ? diseasePacket.evidence.filter((evidence) => evidence.approvalStatus === 'approved').length
    : 0;
  const evidenceApprovalRatio = evidenceCount > 0 ? approvedEvidenceCount / evidenceCount : 0;

  if (diseasePacket.evidenceSummary.governanceVerdict !== 'approved') {
    score -= 0.2;
  }

  if (diseasePacket.evidenceSummary.blockingContradictions > 0) {
    score -= 0.5;
  } else if (diseasePacket.evidenceSummary.contradictionCount > 0) {
    score -= 0.1;
  }

  if (diseasePacket.evidenceSummary.freshnessStatus === 'aging') {
    score -= 0.05;
  } else if (diseasePacket.evidenceSummary.freshnessStatus === 'stale') {
    score -= 0.2;
  }

  if (evidenceCount < 3) {
    score -= 0.15;
  }

  return roundScore(Math.min(score, evidenceApprovalRatio || 0));
}

/**
 * @param {any} context
 * @returns {{ preview: any | null, error: string | null }}
 */
function buildReleasePreview(context) {
  if (context.releasePreview) {
    return context.releasePreview;
  }

  if (!context.project || !context.diseasePacket) {
    context.releasePreview = {
      preview: null,
      error: 'A project and disease packet are required to preview release governance.',
    };
    return context.releasePreview;
  }

  try {
    const preview = context.exporterService.assembleRelease({
      workflowRun: context.workflowRun,
      project: context.project,
      actor: context.actor,
      diseasePacket: context.diseasePacket,
      qaReports: context.qaReports,
      artifactManifest: collectReleaseArtifactManifest(context.store, context.workflowRun),
      allowEvaluationBypass: true,
    });

    context.releasePreview = {
      preview,
      error: null,
    };
    return context.releasePreview;
  } catch (error) {
    context.releasePreview = {
      preview: null,
      error: error instanceof Error ? error.message : String(error),
    };
    return context.releasePreview;
  }
}

/**
 * @param {any} evaluationCase
 * @param {any} context
 * @param {any} threshold
 * @returns {{ score: number, status: 'passed' | 'failed', message: string }}
 */
function scoreEvaluationCase(evaluationCase, context, threshold) {
  const artifactType = evaluationCase.input?.artifact;

  if (typeof artifactType === 'string' && !artifactIsAvailable(artifactType, context)) {
    return {
      score: 0,
      status: 'failed',
      message: `Required artifact ${artifactType} is missing for this run.`,
    };
  }

  let score = 0;

  switch (evaluationCase.evalFamily) {
    case 'medical_accuracy':
      score = artifactType === 'story-workbook'
        ? roundScore(context.primaryQaReport?.scores.medicalAccuracy ?? 0)
        : scoreMedicalPacket(context.diseasePacket);
      break;
    case 'mystery_integrity':
      score = artifactType === 'scene-card'
        ? context.sceneReview.score
        : context.mysteryReview.score;
      break;
    case 'educational_sequencing':
      score = context.sequencingReview.score;
      break;
    case 'panelization':
      score = roundScore((context.sceneReview.score * 0.35) + (context.panelReview.score * 0.65));
      break;
    case 'render_readiness':
      score = context.renderReview.score;
      break;
    case 'governance_release': {
      const preview = buildReleasePreview(context);

      if (artifactType === 'disease-packet') {
        score = context.diseasePacket
          && context.diseasePacket.evidenceSummary.governanceVerdict === 'approved'
          && context.diseasePacket.evidenceSummary.blockingContradictions === 0
          ? 1
          : 0;
        break;
      }

      if (!preview.preview) {
        return {
          score: 0,
          status: 'failed',
          message: preview.error ?? 'Release preview could not be assembled.',
        };
      }

      if (artifactType === 'release-bundle') {
        score = preview.preview.releaseBundle.releaseGateChecks.every((gateCheck) => gateCheck.status === 'passed') ? 1 : 0;
        break;
      }

      if (artifactType === 'release-bundle-index') {
        const bundleIndex = preview.preview.bundleIndexMarkdown;
        score = bundleIndex.includes(preview.preview.releaseBundle.releaseId)
          && bundleIndex.includes(context.actor.id)
          && bundleIndex.includes('Gate Checks')
          ? 1
          : 0;
        break;
      }

      if (artifactType === 'source-evidence-pack') {
        const sourceEvidencePack = preview.preview.sourceEvidencePack;
        score = typeof sourceEvidencePack.sourceSetHash === 'string'
          && Array.isArray(sourceEvidencePack.evidence)
          && sourceEvidencePack.evidence.every((evidenceRecord) => evidenceRecord.claimId && evidenceRecord.sourceId)
          ? 1
          : 0;
        break;
      }

      score = preview.preview.releaseBundle.releaseGateChecks.every((gateCheck) => gateCheck.status === 'passed') ? 1 : 0;
      break;
    }
    default:
      score = 0;
  }

  const minimum = typeof threshold.minimum === 'number' ? threshold.minimum : 1;
  const passed = threshold.mode === 'pass-fail'
    ? score === 1
    : score >= minimum;

  return {
    score: roundScore(score),
    status: passed ? 'passed' : 'failed',
    message: passed
      ? `Case satisfied ${evaluationCase.evalFamily} requirements.`
      : `Case fell below threshold ${minimum.toFixed(2)} for ${evaluationCase.evalFamily}.`,
  };
}

/**
 * @param {string} family
 * @param {any[]} cases
 * @param {any} threshold
 * @param {any} context
 * @returns {any}
 */
function evaluateFamily(family, cases, threshold, context) {
  const applicableCases = cases.filter((evaluationCase) => isCaseApplicable(evaluationCase, context));

  if (applicableCases.length === 0) {
    return {
      family,
      mode: threshold.mode ?? 'ratio',
      releaseGate: threshold.release_gate,
      threshold: threshold.minimum ?? 1,
      status: 'not-applicable',
      score: 1,
      applicableCaseCount: 0,
      passedCaseCount: 0,
      failedCaseCount: 0,
      cases: [],
    };
  }

  const caseResults = applicableCases.map((evaluationCase) => {
    const caseScore = scoreEvaluationCase(evaluationCase, context, threshold);

    return {
      caseId: evaluationCase.caseId,
      artifactType: evaluationCase.input?.artifact ?? 'workflow-run',
      status: caseScore.status,
      score: caseScore.score,
      threshold: threshold.minimum ?? 1,
      message: caseScore.message,
    };
  });
  const passedCaseCount = caseResults.filter((caseResult) => caseResult.status === 'passed').length;
  const failedCaseCount = caseResults.length - passedCaseCount;
  const score = threshold.mode === 'pass-fail'
    ? roundScore(failedCaseCount === 0 ? 1 : 0)
    : roundScore(passedCaseCount / caseResults.length);
  const minimum = typeof threshold.minimum === 'number' ? threshold.minimum : 1;
  const passed = threshold.mode === 'pass-fail' ? score === 1 : score >= minimum;

  return {
    family,
    mode: threshold.mode ?? 'ratio',
    releaseGate: threshold.release_gate,
    threshold: minimum,
    status: passed ? 'passed' : 'failed',
    score,
    applicableCaseCount: caseResults.length,
    passedCaseCount,
    failedCaseCount,
    cases: caseResults,
  };
}

/**
 * @param {import('./store.mjs').PlatformStore} store
 * @param {any} workflowRun
 * @param {any} actor
 * @param {any} exporterService
 * @returns {any}
 */
function buildEvaluationContext(store, workflowRun, actor, exporterService) {
  const project = store.getProject(workflowRun.projectId);
  const diseasePacket = loadLatestArtifactByType(store, workflowRun, 'disease-packet');
  const storyWorkbook = loadLatestArtifactByType(store, workflowRun, 'story-workbook');
  const qaReports = loadArtifactsByType(store, workflowRun, 'qa-report');
  const sceneCards = loadArtifactsByType(store, workflowRun, 'scene-card');
  const panelPlans = loadArtifactsByType(store, workflowRun, 'panel-plan');
  const renderPrompts = loadArtifactsByType(store, workflowRun, 'render-prompt');
  const letteringMaps = loadArtifactsByType(store, workflowRun, 'lettering-map');
  const primaryQaReport = selectPrimaryQaReport(qaReports);

  return {
    store,
    actor,
    exporterService,
    workflowRun,
    project,
    diseasePacket,
    storyWorkbook,
    qaReports,
    primaryQaReport,
    sceneCards,
    panelPlans,
    renderPrompts,
    letteringMaps,
    availableArtifactTypes: new Set(workflowRun.artifacts.map((artifactReference) => artifactReference.artifactType)),
    canonicalDiseaseName: normalizeName(diseasePacket?.canonicalDiseaseName ?? workflowRun.input?.diseaseName),
    mysteryReview: storyWorkbook && diseasePacket
      ? reviewMysteryIntegrity(storyWorkbook, diseasePacket)
      : { score: 0, findings: [] },
    sequencingReview: storyWorkbook && diseasePacket
      ? reviewEducationalSequencing(storyWorkbook, diseasePacket)
      : { score: 0, findings: [] },
    sceneReview: reviewSceneCards(sceneCards),
    panelReview: reviewPanelPlans(panelPlans),
    renderReview: reviewRenderPrompts(renderPrompts, letteringMaps),
    releasePreview: null,
  };
}

/**
 * @param {any} evalRun
 * @returns {any}
 */
export function summarizeEvalRun(evalRun) {
  return {
    evalRunId: evalRun.id,
    evaluatedAt: evalRun.evaluatedAt,
    allThresholdsMet: evalRun.summary.allThresholdsMet,
    applicableFamilyCount: evalRun.summary.applicableFamilyCount,
    passedFamilyCount: evalRun.summary.passedFamilyCount,
    failedFamilyCount: evalRun.summary.failedFamilyCount,
  };
}

export class EvalService {
  /**
   * @param {{ rootDir?: string, exporterService: any }} options
   */
  constructor(options) {
    this.rootDir = options.rootDir ?? findRepoRoot(import.meta.url);
    this.exporterService = options.exporterService;
    this.registry = loadEvalRegistry(this.rootDir);
    this.thresholds = loadEvalThresholds(this.rootDir);
    this.casesByFamily = loadEvaluationCases(this.rootDir, this.registry);
  }

  /**
   * @param {{ store: import('./store.mjs').PlatformStore, workflowRun: any, actor: any }} options
   * @returns {any}
   */
  runForWorkflowRun(options) {
    const context = buildEvaluationContext(
      options.store,
      options.workflowRun,
      options.actor,
      this.exporterService,
    );
    const familyResults = Object.entries(this.casesByFamily)
      .map(([family, cases]) => evaluateFamily(
        family,
        cases,
        this.thresholds[family] ?? { minimum: 1, mode: 'ratio' },
        context,
      ));
    const applicableFamilyResults = familyResults.filter((familyResult) => familyResult.status !== 'not-applicable');
    const passedFamilyCount = applicableFamilyResults.filter((familyResult) => familyResult.status === 'passed').length;
    const failedFamilyCount = applicableFamilyResults.length - passedFamilyCount;
    const applicableCaseCount = applicableFamilyResults.reduce((total, familyResult) => total + familyResult.applicableCaseCount, 0);
    const passedCaseCount = applicableFamilyResults.reduce((total, familyResult) => total + familyResult.passedCaseCount, 0);
    const failedCaseCount = applicableCaseCount - passedCaseCount;
    const evaluatedAt = new Date().toISOString();

    return {
      schemaVersion: SCHEMA_VERSION,
      id: createId('evr'),
      workflowRunId: options.workflowRun.id,
      tenantId: options.workflowRun.tenantId,
      canonicalDiseaseName: context.diseasePacket?.canonicalDiseaseName ?? options.workflowRun.input.diseaseName,
      evaluatedBy: options.actor.id,
      evaluatedAt,
      latestRelevantArtifactAt: getLatestRelevantArtifactAt(options.store, options.workflowRun),
      familyResults,
      summary: {
        applicableFamilyCount: applicableFamilyResults.length,
        passedFamilyCount,
        failedFamilyCount,
        applicableCaseCount,
        passedCaseCount,
        failedCaseCount,
        allThresholdsMet: failedFamilyCount === 0,
      },
    };
  }
}

/**
 * @param {string} [rootDir]
 * @returns {any}
 */
export function loadEvalRegistry(rootDir = findRepoRoot(import.meta.url)) {
  return YAML.parse(readFileSync(path.join(rootDir, 'evals', 'registry.yaml'), 'utf8'));
}

/**
 * @param {string} [rootDir]
 * @returns {Record<string, any>}
 */
export function loadEvalThresholds(rootDir = findRepoRoot(import.meta.url)) {
  return YAML.parse(readFileSync(path.join(rootDir, 'evals', 'thresholds.yaml'), 'utf8'));
}

/**
 * @param {string} [rootDir]
 * @param {any} [registry]
 * @returns {Record<string, any[]>}
 */
export function loadEvaluationCases(rootDir = findRepoRoot(import.meta.url), registry = loadEvalRegistry(rootDir)) {
  /** @type {Record<string, any[]>} */
  const casesByFamily = {};

  for (const dataset of registry.datasets ?? []) {
    const datasetPath = path.join(rootDir, dataset.path);
    const evaluationCases = parseJsonLines(readFileSync(datasetPath, 'utf8'));
    casesByFamily[dataset.family] = evaluationCases;
  }

  return casesByFamily;
}

/**
 * @param {{ rootDir?: string, exporterService: any }} options
 * @returns {EvalService}
 */
export function createEvalService(options) {
  return new EvalService(options);
}
