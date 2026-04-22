import { createServer } from 'node:http';
import path from 'node:path';

import { createId } from '../../../packages/shared-config/src/ids.mjs';
import {
  readFormBody,
  readJsonBody,
  redirect,
  sendError,
  sendHtml,
  sendJson,
} from '../../../packages/shared-config/src/http.mjs';
import { findRepoRoot } from '../../../packages/shared-config/src/repo-paths.mjs';
import { createSchemaRegistry, formatValidationErrors } from '../../../packages/shared-config/src/schema-registry.mjs';
import { createClinicalRetrievalService } from '../../clinical-retrieval/src/service.mjs';
import { createExporterService } from '../../exporter/src/service.mjs';
import {
  applyWorkflowEvent,
  areRequiredApprovalsApproved,
  createDraftWorkflowRun,
  loadWorkflowSpec,
} from '../../orchestrator/src/workflow-machine.mjs';
import { createStoryEngineService } from '../../story-engine/src/service.mjs';
import {
  buildEvidenceTraceabilitySummary,
  createEvalService,
  deriveEvalStatus,
  listEvaluationReferences,
  summarizeEvalRun,
} from './eval-service.mjs';
import {
  canAccessTenant,
  canApplyManualWorkflowEvent,
  canCreateProject,
  canExportRun,
  canResolveCanonicalization,
  canStartWorkflow,
  canSubmitApproval,
  canViewTenantData,
  getActorFromRequest,
  getDefaultTenantId,
  normalizeTenantId,
} from './auth.mjs';
import {
  renderIntakePage,
  renderReviewDashboard,
  renderReviewRunPage,
} from './review-ui.mjs';
import { PlatformStore } from './store.mjs';

const SCHEMA_VERSION = '1.0.0';

/**
 * @typedef {{
 *   diseaseName: string,
 *   title?: string,
 *   audienceTier?: string,
 *   lengthProfile?: string,
 *   qualityProfile?: string,
 *   styleProfile?: string,
 * }} DiseaseIntakeRequest
 */

/**
 * @typedef {{
 *   diseaseName: string,
 *   audienceTier?: string,
 *   lengthProfile?: string,
 *   qualityProfile?: string,
 *   styleProfile?: string,
 * }} WorkflowInput
 */

/**
 * @typedef {{
 *   artifactType: string,
 *   artifactId: string,
 *   status: string,
 *   path?: string,
 * }} WorkflowArtifactReference
 */

/**
 * @param {number} statusCode
 * @param {string} message
 * @param {unknown} [details]
 * @returns {Error & { statusCode: number, details?: unknown }}
 */
function createHttpError(statusCode, message, details = undefined) {
  const error = new Error(message);
  // @ts-ignore - lightweight error shape for route handling.
  error.statusCode = statusCode;
  // @ts-ignore - lightweight error shape for route handling.
  error.details = details;
  return /** @type {Error & { statusCode: number, details?: unknown }} */ (error);
}

/**
 * @template T
 * @param {T} value
 * @returns {T}
 */
function clone(value) {
  return structuredClone(value);
}

/**
 * @param {string} diseaseName
 * @returns {string}
 */
function defaultProjectTitle(diseaseName) {
  const normalized = diseaseName.trim();

  if (!normalized) {
    return 'Untitled disease project';
  }

  return `${normalized[0].toUpperCase()}${normalized.slice(1)} starter project`;
}

/**
 * @param {unknown} payload
 * @returns {payload is Record<string, unknown>}
 */
function isRecord(payload) {
  return Boolean(payload) && typeof payload === 'object' && !Array.isArray(payload);
}

/**
 * @param {string} rawUrl
 * @returns {URL}
 */
function createRequestUrl(rawUrl) {
  return new URL(rawUrl, 'http://127.0.0.1');
}

/**
 * @param {string} pathname
 * @returns {{ projectId: string } | null}
 */
function matchProjectPath(pathname) {
  const match = pathname.match(/^\/api\/v1\/projects\/([^/]+)$/);
  return match ? { projectId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ runId: string } | null}
 */
function matchWorkflowRunPath(pathname) {
  const match = pathname.match(/^\/api\/v1\/workflow-runs\/([^/]+)$/);
  return match ? { runId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ runId: string } | null}
 */
function matchWorkflowRunApprovalPath(pathname) {
  const match = pathname.match(/^\/api\/v1\/workflow-runs\/([^/]+)\/approvals$/);
  return match ? { runId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ runId: string } | null}
 */
function matchWorkflowRunEventPath(pathname) {
  const match = pathname.match(/^\/api\/v1\/workflow-runs\/([^/]+)\/events$/);
  return match ? { runId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ runId: string } | null}
 */
function matchWorkflowRunCanonicalizationResolutionPath(pathname) {
  const match = pathname.match(/^\/api\/v1\/workflow-runs\/([^/]+)\/canonicalization-resolution$/);
  return match ? { runId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ runId: string } | null}
 */
function matchWorkflowRunAuditLogPath(pathname) {
  const match = pathname.match(/^\/api\/v1\/workflow-runs\/([^/]+)\/audit-log-entries$/);
  return match ? { runId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ runId: string } | null}
 */
function matchWorkflowRunExportPath(pathname) {
  const match = pathname.match(/^\/api\/v1\/workflow-runs\/([^/]+)\/exports$/);
  return match ? { runId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ runId: string } | null}
 */
function matchWorkflowRunEvaluationPath(pathname) {
  const match = pathname.match(/^\/api\/v1\/workflow-runs\/([^/]+)\/evaluations$/);
  return match ? { runId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ runId: string } | null}
 */
function matchWorkflowRunClinicalPackagePath(pathname) {
  const match = pathname.match(/^\/api\/v1\/workflow-runs\/([^/]+)\/clinical-package$/);
  return match ? { runId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ runId: string } | null}
 */
function matchWorkflowRunClinicalPackageRebuildPath(pathname) {
  const match = pathname.match(/^\/api\/v1\/workflow-runs\/([^/]+)\/clinical-package\/rebuild$/);
  return match ? { runId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ evalRunId: string } | null}
 */
function matchEvaluationPath(pathname) {
  const match = pathname.match(/^\/api\/v1\/evaluations\/([^/]+)$/);
  return match ? { evalRunId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ artifactType: string, artifactId: string } | null}
 */
function matchArtifactPath(pathname) {
  const match = pathname.match(/^\/api\/v1\/artifacts\/([^/]+)\/([^/]+)$/);
  return match
    ? {
      artifactType: decodeURIComponent(match[1]),
      artifactId: decodeURIComponent(match[2]),
    }
    : null;
}

/**
 * @param {string} pathname
 * @returns {{ claimId: string } | null}
 */
function matchEvidenceRecordPath(pathname) {
  const match = pathname.match(/^\/api\/v1\/evidence-records\/([^/]+)$/);
  return match ? { claimId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ claimId: string } | null}
 */
function matchContradictionResolutionPath(pathname) {
  const match = pathname.match(/^\/api\/v1\/evidence-records\/([^/]+)\/contradiction-resolutions$/);
  return match ? { claimId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ sourceId: string } | null}
 */
function matchSourceRecordPath(pathname) {
  const match = pathname.match(/^\/api\/v1\/source-records\/([^/]+)$/);
  return match ? { sourceId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ sourceId: string } | null}
 */
function matchSourceGovernanceDecisionPath(pathname) {
  const match = pathname.match(/^\/api\/v1\/source-records\/([^/]+)\/governance-decisions$/);
  return match ? { sourceId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ releaseId: string } | null}
 */
function matchReleaseBundlePath(pathname) {
  const match = pathname.match(/^\/api\/v1\/release-bundles\/([^/]+)$/);
  return match ? { releaseId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ releaseId: string } | null}
 */
function matchReleaseBundleIndexPath(pathname) {
  const match = pathname.match(/^\/api\/v1\/release-bundles\/([^/]+)\/index$/);
  return match ? { releaseId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ releaseId: string } | null}
 */
function matchReleaseEvidencePackPath(pathname) {
  const match = pathname.match(/^\/api\/v1\/release-bundles\/([^/]+)\/evidence-pack$/);
  return match ? { releaseId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ runId: string } | null}
 */
function matchReviewRunPath(pathname) {
  const match = pathname.match(/^\/review\/runs\/([^/]+)$/);
  return match ? { runId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ runId: string } | null}
 */
function matchReviewRunApprovalActionPath(pathname) {
  const match = pathname.match(/^\/review\/runs\/([^/]+)\/approvals$/);
  return match ? { runId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ runId: string } | null}
 */
function matchReviewRunCanonicalizationActionPath(pathname) {
  const match = pathname.match(/^\/review\/runs\/([^/]+)\/canonicalization-resolution$/);
  return match ? { runId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ runId: string } | null}
 */
function matchReviewRunEvaluationActionPath(pathname) {
  const match = pathname.match(/^\/review\/runs\/([^/]+)\/evaluations$/);
  return match ? { runId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ runId: string } | null}
 */
function matchReviewRunClinicalPackageRebuildActionPath(pathname) {
  const match = pathname.match(/^\/review\/runs\/([^/]+)\/clinical-package\/rebuild$/);
  return match ? { runId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ runId: string, sourceId: string } | null}
 */
function matchReviewRunSourceGovernanceActionPath(pathname) {
  const match = pathname.match(/^\/review\/runs\/([^/]+)\/source-records\/([^/]+)\/governance-decisions$/);
  return match ? { runId: decodeURIComponent(match[1]), sourceId: decodeURIComponent(match[2]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ runId: string, claimId: string } | null}
 */
function matchReviewRunContradictionResolutionActionPath(pathname) {
  const match = pathname.match(/^\/review\/runs\/([^/]+)\/evidence-records\/([^/]+)\/contradiction-resolutions$/);
  return match ? { runId: decodeURIComponent(match[1]), claimId: decodeURIComponent(match[2]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ runId: string } | null}
 */
function matchReviewRunExportActionPath(pathname) {
  const match = pathname.match(/^\/review\/runs\/([^/]+)\/exports$/);
  return match ? { runId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {any} schemaRegistry
 * @param {string} schemaId
 * @param {unknown} payload
 * @returns {{ valid: boolean, error: string | null }}
 */
function validatePayload(schemaRegistry, schemaId, payload) {
  const result = schemaRegistry.validateBySchemaId(schemaId, payload);

  if (result.valid) {
    return {
      valid: true,
      error: null,
    };
  }

  return {
    valid: false,
    error: formatValidationErrors(result.errors),
  };
}

/**
 * @param {any} schemaRegistry
 * @param {string} schemaId
 * @param {unknown} payload
 * @returns {void}
 */
function assertSchema(schemaRegistry, schemaId, payload) {
  schemaRegistry.assertValid(schemaId, payload);
}

/**
 * @param {unknown} payload
 * @returns {DiseaseIntakeRequest}
 */
function toDiseaseIntakeRequest(payload) {
  if (!isRecord(payload) || typeof payload.diseaseName !== 'string') {
    throw new Error('Disease intake request requires a diseaseName string.');
  }

  /** @type {DiseaseIntakeRequest} */
  const intakeRequest = {
    diseaseName: payload.diseaseName,
  };

  if (typeof payload.title === 'string') {
    intakeRequest.title = payload.title;
  }

  if (typeof payload.audienceTier === 'string') {
    intakeRequest.audienceTier = payload.audienceTier;
  }

  if (typeof payload.lengthProfile === 'string') {
    intakeRequest.lengthProfile = payload.lengthProfile;
  }

  if (typeof payload.qualityProfile === 'string') {
    intakeRequest.qualityProfile = payload.qualityProfile;
  }

  if (typeof payload.styleProfile === 'string') {
    intakeRequest.styleProfile = payload.styleProfile;
  }

  return intakeRequest;
}

/**
 * @param {unknown} payload
 * @returns {WorkflowInput}
 */
function toWorkflowInput(payload) {
  const intakeRequest = toDiseaseIntakeRequest(payload);

  /** @type {WorkflowInput} */
  const workflowInput = {
    diseaseName: intakeRequest.diseaseName,
  };

  if (intakeRequest.audienceTier) {
    workflowInput.audienceTier = intakeRequest.audienceTier;
  }

  if (intakeRequest.lengthProfile) {
    workflowInput.lengthProfile = intakeRequest.lengthProfile;
  }

  if (intakeRequest.qualityProfile) {
    workflowInput.qualityProfile = intakeRequest.qualityProfile;
  }

  if (intakeRequest.styleProfile) {
    workflowInput.styleProfile = intakeRequest.styleProfile;
  }

  return workflowInput;
}

/**
 * @param {any} workflowRun
 * @param {WorkflowArtifactReference} artifactReference
 * @returns {any}
 */
function upsertArtifactReference(workflowRun, artifactReference) {
  const nextArtifacts = workflowRun.artifacts.filter((/** @type {WorkflowArtifactReference} */ artifact) => !(
    artifact.artifactType === artifactReference.artifactType && artifact.artifactId === artifactReference.artifactId
  ));

  nextArtifacts.push(artifactReference);

  return {
    ...workflowRun,
    artifacts: nextArtifacts,
  };
}

/**
 * @param {PlatformStore} store
 * @param {any} schemaRegistry
 * @param {{ event: any, workflowRun: any }} transition
 * @returns {any}
 */
function persistTransition(store, schemaRegistry, transition) {
  assertSchema(schemaRegistry, 'contracts/workflow-event.schema.json', transition.event);
  assertSchema(schemaRegistry, 'contracts/workflow-run.schema.json', transition.workflowRun);
  store.saveWorkflowRun(transition.workflowRun);
  store.appendWorkflowEvent(transition.event);
  return transition.workflowRun;
}

/**
 * @param {PlatformStore} store
 * @param {any} schemaRegistry
 * @param {any} workflowRun
 * @returns {any}
 */
function saveWorkflowRunRecord(store, schemaRegistry, workflowRun) {
  assertSchema(schemaRegistry, 'contracts/workflow-run.schema.json', workflowRun);
  store.saveWorkflowRun(workflowRun);
  return workflowRun;
}

/**
 * @param {any | null} actor
 * @param {import('node:http').ServerResponse} response
 * @returns {actor is any}
 */
function requireLocalActor(actor, response) {
  if (actor) {
    return true;
  }

  sendError(response, 500, 'Local operator is unavailable.', 'Open local mode should always provide a default actor.');
  return false;
}

/**
 * @param {any} record
 * @returns {string}
 */
function getTenantId(record) {
  return normalizeTenantId(record?.tenantId);
}

/**
 * @param {PlatformStore} store
 * @param {any} workflowRun
 * @returns {any}
 */
function getProjectForRun(store, workflowRun) {
  const project = store.getProject(workflowRun.projectId);

  if (!project) {
    throw createHttpError(500, `Project ${workflowRun.projectId} is missing for workflow run ${workflowRun.id}.`);
  }

  return project;
}

/**
 * @param {PlatformStore} store
 * @param {string} artifactType
 * @param {string} artifactId
 * @returns {any | null}
 */
function findWorkflowRunByArtifactReference(store, artifactType, artifactId) {
  for (const workflowRun of store.listWorkflowRuns()) {
    if (workflowRun.artifacts.some((/** @type {WorkflowArtifactReference} */ artifact) => (
      artifact.artifactType === artifactType && artifact.artifactId === artifactId
    ))) {
      return workflowRun;
    }
  }

  return null;
}

/**
 * @param {PlatformStore} store
 * @param {WorkflowArtifactReference} artifactReference
 * @returns {any | null}
 */
function loadArtifactByReference(store, artifactReference) {
  if (artifactReference.artifactType === 'project') {
    return store.getProject(artifactReference.artifactId);
  }

  return store.getArtifact(artifactReference.artifactType, artifactReference.artifactId);
}

/**
 * @param {any} workflowRun
 * @param {string} artifactType
 * @returns {WorkflowArtifactReference | null}
 */
function findLatestArtifactReference(workflowRun, artifactType) {
  const matchingArtifacts = workflowRun.artifacts.filter(
    (/** @type {WorkflowArtifactReference} */ artifact) => artifact.artifactType === artifactType,
  );

  return matchingArtifacts.at(-1) ?? null;
}

/**
 * @param {PlatformStore} store
 * @param {any} workflowRun
 * @param {string} artifactType
 * @returns {any | null}
 */
function loadLatestArtifact(store, workflowRun, artifactType) {
  const artifactReference = findLatestArtifactReference(workflowRun, artifactType);
  return artifactReference ? loadArtifactByReference(store, artifactReference) : null;
}

/**
 * @param {any[]} values
 * @returns {string[]}
 */
function collectUniqueClaimIds(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim().length > 0))];
}

/**
 * @param {PlatformStore} store
 * @param {any} workflowRun
 * @returns {any | null}
 */
function loadResolvedCanonicalDiseaseForRun(store, workflowRun) {
  const canonicalDisease = loadLatestArtifact(store, workflowRun, 'canonical-disease');

  if (!canonicalDisease || canonicalDisease.resolutionStatus !== 'resolved') {
    return null;
  }

  return canonicalDisease;
}

/**
 * @param {PlatformStore} store
 * @param {any} workflowRun
 * @returns {Array<{ artifactType: string, artifactId: string, artifact: any }>}
 */
function collectArtifactsForRun(store, workflowRun) {
  return workflowRun.artifacts
    .map((/** @type {WorkflowArtifactReference} */ artifactReference) => ({
      artifactType: artifactReference.artifactType,
      artifactId: artifactReference.artifactId,
      artifact: loadArtifactByReference(store, artifactReference),
    }))
    .filter((/** @type {{ artifact: any }} */ entry) => entry.artifact);
}

/**
 * @param {PlatformStore} store
 * @param {string} artifactType
 * @param {string} tenantId
 * @returns {any[]}
 */
function listTenantArtifactsByType(store, artifactType, tenantId) {
  return store.listArtifactsByType(artifactType, {
    tenantId: normalizeTenantId(tenantId),
  });
}

/**
 * @param {PlatformStore} store
 * @param {any} workflowRun
 * @returns {Array<{ artifactType: string, artifactId: string, location: string, checksum: string, contentType: string, retentionClass: string }>}
 */
function collectReleaseArtifactManifest(store, workflowRun) {
  return workflowRun.artifacts
    .filter((/** @type {WorkflowArtifactReference} */ artifactReference) => artifactReference.artifactType !== 'project')
    .map((/** @type {WorkflowArtifactReference} */ artifactReference) => {
      const artifactMetadata = store.getArtifactMetadata(artifactReference.artifactType, artifactReference.artifactId);

      if (!artifactMetadata) {
        throw createHttpError(500, `Artifact metadata missing for ${artifactReference.artifactType}:${artifactReference.artifactId}.`);
      }

      return {
        artifactType: artifactReference.artifactType,
        artifactId: artifactReference.artifactId,
        location: artifactMetadata.location,
        checksum: artifactMetadata.checksum,
        contentType: artifactMetadata.contentType,
        retentionClass: artifactMetadata.retentionClass,
      };
    });
}

/**
 * @param {PlatformStore} store
 * @param {any} schemaRegistry
 * @param {any | null} actor
 * @param {string} action
 * @param {string} subjectType
 * @param {string} subjectId
 * @param {'success' | 'denied' | 'error'} outcome
 * @param {string | undefined} reason
 * @param {Record<string, unknown> | undefined} metadata
 * @returns {any}
 */
function appendAuditLog(store, schemaRegistry, actor, action, subjectType, subjectId, outcome, reason, metadata = undefined) {
  /** @type {any} */
  const auditLogEntry = {
    schemaVersion: SCHEMA_VERSION,
    id: createId('aud'),
    actorId: actor?.id ?? 'anonymous',
    actorRoles: actor?.roles ? [...actor.roles] : ['Anonymous'],
    action,
    subjectType,
    subjectId,
    tenantId: actor?.tenantId ?? (typeof metadata?.tenantId === 'string' ? metadata.tenantId : 'tenant.unknown'),
    outcome,
    occurredAt: new Date().toISOString(),
  };

  if (reason) {
    auditLogEntry.reason = reason;
  }

  if (metadata && Object.keys(metadata).length > 0) {
    auditLogEntry.metadata = clone(metadata);
  }

  assertSchema(schemaRegistry, 'contracts/audit-log-entry.schema.json', auditLogEntry);
  return store.appendAuditLogEntry(auditLogEntry, {
    tenantId: actor?.tenantId,
  });
}

/**
 * @param {PlatformStore} store
 * @param {any} schemaRegistry
 * @param {any | null} actor
 * @param {string} action
 * @param {string} subjectType
 * @param {string} subjectId
 * @param {string} message
 * @returns {never}
 */
function denyWithAudit(store, schemaRegistry, actor, action, subjectType, subjectId, message) {
  appendAuditLog(store, schemaRegistry, actor, action, subjectType, subjectId, 'denied', message);
  throw createHttpError(403, message);
}

/**
 * @param {any | null} actor
 * @param {string} tenantId
 * @param {PlatformStore} store
 * @param {any} schemaRegistry
 * @param {string} action
 * @param {string} subjectType
 * @param {string} subjectId
 * @returns {void}
 */
function assertTenantAccess(actor, tenantId, store, schemaRegistry, action, subjectType, subjectId) {
  if (!canAccessTenant(actor, tenantId)) {
    denyWithAudit(store, schemaRegistry, actor, action, subjectType, subjectId, 'Actor cannot access this tenant resource.');
  }
}

/**
 * @param {PlatformStore} store
 * @param {any} schemaRegistry
 * @param {any} workflowRun
 * @param {string} artifactType
 * @param {string} schemaId
 * @param {any} artifact
 * @param {string} [status]
 * @returns {any}
 */
function persistArtifact(store, schemaRegistry, workflowRun, artifactType, schemaId, artifact, status = 'generated') {
  assertSchema(schemaRegistry, schemaId, artifact);
  const artifactId = typeof artifact?.id === 'string'
    ? artifact.id
    : (typeof artifact?.releaseId === 'string' ? artifact.releaseId : null);

  if (!artifactId) {
    throw createHttpError(500, `Artifact ${artifactType} did not expose a persistable identifier.`);
  }

  store.saveArtifact(artifactType, artifactId, artifact, {
    tenantId: workflowRun.tenantId,
  });
  return markLatestEvalPossiblyStale(upsertArtifactReference(workflowRun, {
    artifactType,
    artifactId,
    status,
  }), artifactType);
}

/**
 * @param {PlatformStore} store
 * @param {any} schemaRegistry
 * @param {any} workflowSpec
 * @param {any} workflowRun
 * @param {{ eventType: string, actor: { type: string, id: string }, payload?: Record<string, unknown>, notes?: string }} eventInput
 * @returns {any}
 */
function transitionWorkflow(store, schemaRegistry, workflowSpec, workflowRun, eventInput) {
  return persistTransition(
    store,
    schemaRegistry,
    applyWorkflowEvent(
      workflowSpec,
      workflowRun,
      eventInput,
      createId('evt'),
      new Date().toISOString(),
    ),
  );
}

/**
 * @param {PlatformStore} store
 * @param {string} tenantId
 * @param {string} artifactType
 * @returns {any[]}
 */
function listTenantGovernanceArtifacts(store, tenantId, artifactType) {
  return store.listArtifactsByType(artifactType, {
    tenantId: normalizeTenantId(tenantId),
  });
}

/**
 * @param {PlatformStore} store
 * @param {any} workflowRun
 * @param {string} canonicalDiseaseName
 * @returns {{ governanceDecisions: any[], contradictionResolutions: any[] }}
 */
function loadClinicalGovernanceState(store, workflowRun, canonicalDiseaseName) {
  const governanceDecisions = listTenantGovernanceArtifacts(store, workflowRun.tenantId, 'source-governance-decision')
    .filter((decision) => decision.canonicalDiseaseName === canonicalDiseaseName);
  const contradictionResolutions = listTenantGovernanceArtifacts(store, workflowRun.tenantId, 'contradiction-resolution')
    .filter((resolution) => resolution.canonicalDiseaseName === canonicalDiseaseName);

  return {
    governanceDecisions,
    contradictionResolutions,
  };
}

/**
 * @param {{
 *   store: PlatformStore,
 *   workflowRun: any,
 *   clinicalService: any,
 *   canonicalDisease: any,
 * }} options
 * @returns {any}
 */
function buildClinicalPackageForRun(options) {
  const governanceState = loadClinicalGovernanceState(
    options.store,
    options.workflowRun,
    options.canonicalDisease.canonicalDiseaseName,
  );
  const clinicalPackage = options.clinicalService.buildClinicalPackage(
    options.canonicalDisease,
    governanceState,
  );

  return {
    ...clinicalPackage,
    evidenceRelationships: options.clinicalService.listEvidenceRelationships(
      options.canonicalDisease.canonicalDiseaseName,
      {
        contradictionResolutions: governanceState.contradictionResolutions,
      },
    ),
    ...governanceState,
  };
}

/**
 * @param {{ store: PlatformStore, workflowRun: any, clinicalService: any }} options
 * @returns {any | null}
 */
function loadClinicalPackageForRun(options) {
  const canonicalDisease = loadResolvedCanonicalDiseaseForRun(options.store, options.workflowRun);

  if (!canonicalDisease) {
    return null;
  }

  const governanceState = loadClinicalGovernanceState(
    options.store,
    options.workflowRun,
    canonicalDisease.canonicalDiseaseName,
  );
  const generatedClinicalPackage = options.clinicalService.buildClinicalPackage(
    canonicalDisease,
    governanceState,
  );
  const diseasePacket = loadLatestArtifact(options.store, options.workflowRun, 'disease-packet') ?? generatedClinicalPackage.diseasePacket;
  const factTable = loadLatestArtifact(options.store, options.workflowRun, 'fact-table') ?? generatedClinicalPackage.factTable;
  const evidenceGraph = loadLatestArtifact(options.store, options.workflowRun, 'evidence-graph') ?? generatedClinicalPackage.evidenceGraph;
  const clinicalTeachingPoints = loadLatestArtifact(options.store, options.workflowRun, 'clinical-teaching-points') ?? generatedClinicalPackage.clinicalTeachingPoints;
  const visualAnchorCatalog = loadLatestArtifact(options.store, options.workflowRun, 'visual-anchor-catalog') ?? generatedClinicalPackage.visualAnchorCatalog;
  const storyWorkbook = loadLatestArtifact(options.store, options.workflowRun, 'story-workbook');
  const sceneCards = collectArtifactsForRun(options.store, options.workflowRun)
    .filter((entry) => entry.artifactType === 'scene-card')
    .map((entry) => entry.artifact);
  const panelPlans = collectArtifactsForRun(options.store, options.workflowRun)
    .filter((entry) => entry.artifactType === 'panel-plan')
    .map((entry) => entry.artifact);
  const renderPrompts = collectArtifactsForRun(options.store, options.workflowRun)
    .filter((entry) => entry.artifactType === 'render-prompt')
    .map((entry) => entry.artifact);
  const letteringMaps = collectArtifactsForRun(options.store, options.workflowRun)
    .filter((entry) => entry.artifactType === 'lettering-map')
    .map((entry) => entry.artifact);

  return {
    runId: options.workflowRun.id,
    canonicalDisease,
    diseasePacket,
    factTable,
    evidenceGraph,
    clinicalTeachingPoints,
    visualAnchorCatalog,
    sourceRecords: generatedClinicalPackage.sourceRecords,
    evidenceRecords: generatedClinicalPackage.evidenceRecords,
    evidenceRelationships: options.clinicalService.listEvidenceRelationships(
      canonicalDisease.canonicalDiseaseName,
      {
        contradictionResolutions: governanceState.contradictionResolutions,
      },
    ),
    governanceDecisions: governanceState.governanceDecisions,
    contradictionResolutions: governanceState.contradictionResolutions,
    traceCoverage: diseasePacket
      ? buildEvidenceTraceabilitySummary({
        diseasePacket,
        storyWorkbook,
        sceneCards,
        panelPlans,
        renderPrompts,
        letteringMaps,
      })
      : null,
  };
}

/**
 * @param {{ store: PlatformStore, schemaRegistry: any, workflowRun: any, clinicalPackage: any }} options
 * @returns {any}
 */
function persistClinicalArtifacts(options) {
  let workflowRun = options.workflowRun;

  workflowRun = persistArtifact(
    options.store,
    options.schemaRegistry,
    workflowRun,
    'disease-packet',
    'contracts/disease-packet.schema.json',
    options.clinicalPackage.diseasePacket,
    options.clinicalPackage.diseasePacket.evidenceSummary.governanceVerdict === 'blocked' ? 'rejected' : 'generated',
  );
  workflowRun = persistArtifact(
    options.store,
    options.schemaRegistry,
    workflowRun,
    'fact-table',
    'contracts/fact-table.schema.json',
    options.clinicalPackage.factTable,
  );
  workflowRun = persistArtifact(
    options.store,
    options.schemaRegistry,
    workflowRun,
    'evidence-graph',
    'contracts/evidence-graph.schema.json',
    options.clinicalPackage.evidenceGraph,
  );
  workflowRun = persistArtifact(
    options.store,
    options.schemaRegistry,
    workflowRun,
    'clinical-teaching-points',
    'contracts/clinical-teaching-points.schema.json',
    options.clinicalPackage.clinicalTeachingPoints,
  );
  workflowRun = persistArtifact(
    options.store,
    options.schemaRegistry,
    workflowRun,
    'visual-anchor-catalog',
    'contracts/visual-anchor-catalog.schema.json',
    options.clinicalPackage.visualAnchorCatalog,
  );

  return workflowRun;
}

/**
 * @param {{ store: PlatformStore, schemaRegistry: any, workflowRun: any, actor: any, canonicalDiseaseName: string, sourceId: string, decision: string, reason?: string, notes?: string[] }} options
 * @returns {any}
 */
function saveSourceGovernanceDecision(options) {
  const occurredAt = new Date().toISOString();
  /** @type {any} */
  const governanceDecision = {
    schemaVersion: SCHEMA_VERSION,
    id: createId('sgd'),
    tenantId: options.workflowRun.tenantId,
    sourceId: options.sourceId,
    canonicalDiseaseName: options.canonicalDiseaseName,
    decision: options.decision,
    reason: options.reason,
    reviewedAt: occurredAt,
    decidedBy: options.actor.id,
    decidedByRoles: [...options.actor.roles],
    occurredAt,
  };

  if (Array.isArray(options.notes) && options.notes.length > 0) {
    governanceDecision.notes = options.notes;
  }

  assertSchema(options.schemaRegistry, 'contracts/source-governance-decision.schema.json', governanceDecision);
  options.store.saveArtifact('source-governance-decision', governanceDecision.id, governanceDecision, {
    tenantId: options.workflowRun.tenantId,
  });

  appendAuditLog(
    options.store,
    options.schemaRegistry,
    options.actor,
    'source-governance.record',
    'source-record',
    options.sourceId,
    'success',
    `Recorded ${options.decision} for source ${options.sourceId}.`,
    {
      canonicalDiseaseName: options.canonicalDiseaseName,
      decisionId: governanceDecision.id,
    },
  );

  return governanceDecision;
}

/**
 * @param {{ store: PlatformStore, schemaRegistry: any, workflowRun: any, actor: any, canonicalDiseaseName: string, claimId: string, relatedClaimId?: string, status: string, reason?: string }} options
 * @returns {any}
 */
function saveContradictionResolution(options) {
  const occurredAt = new Date().toISOString();
  /** @type {any} */
  const contradictionResolution = {
    schemaVersion: SCHEMA_VERSION,
    id: createId('cdr'),
    tenantId: options.workflowRun.tenantId,
    canonicalDiseaseName: options.canonicalDiseaseName,
    claimId: options.claimId,
    status: options.status,
    reason: options.reason,
    resolvedBy: options.actor.id,
    resolvedByRoles: [...options.actor.roles],
    occurredAt,
  };

  if (options.relatedClaimId) {
    contradictionResolution.relatedClaimId = options.relatedClaimId;
  }

  assertSchema(options.schemaRegistry, 'contracts/contradiction-resolution.schema.json', contradictionResolution);
  options.store.saveArtifact('contradiction-resolution', contradictionResolution.id, contradictionResolution, {
    tenantId: options.workflowRun.tenantId,
  });

  appendAuditLog(
    options.store,
    options.schemaRegistry,
    options.actor,
    'contradiction-resolution.record',
    'evidence-record',
    options.claimId,
    'success',
    `Recorded contradiction status ${options.status} for claim ${options.claimId}.`,
    {
      canonicalDiseaseName: options.canonicalDiseaseName,
      relatedClaimId: options.relatedClaimId,
      resolutionId: contradictionResolution.id,
    },
  );

  return contradictionResolution;
}

/**
 * @param {{
 *   store: PlatformStore,
 *   schemaRegistry: any,
 *   workflowSpec: any,
 *   clinicalService: any,
 *   storyEngineService: any,
 *   workflowRun: any,
 *   actor: any,
 *   reason?: string,
 * }} options
 * @returns {any}
 */
function rebuildClinicalPackageForRun(options) {
  const canonicalDisease = loadResolvedCanonicalDiseaseForRun(options.store, options.workflowRun);

  if (!canonicalDisease) {
    throw createHttpError(409, 'A resolved canonical disease artifact is required before rebuilding the clinical package.');
  }

  const timestamp = new Date().toISOString();
  let workflowRun = resetWorkflowForClinicalRebuild(
    options.workflowSpec,
    options.workflowRun,
    timestamp,
    options.reason ?? 'Rebuilding the clinical package after local governance updates.',
  );

  workflowRun = saveWorkflowRunRecord(options.store, options.schemaRegistry, workflowRun);

  appendAuditLog(
    options.store,
    options.schemaRegistry,
    options.actor,
    'clinical-package.rebuild',
    'workflow-run',
    workflowRun.id,
    'success',
    options.reason ?? 'Rebuilt the clinical package and invalidated downstream artifacts.',
    {
      canonicalDiseaseName: canonicalDisease.canonicalDiseaseName,
    },
  );

  return continueClinicalStage({
    store: options.store,
    schemaRegistry: options.schemaRegistry,
    workflowSpec: options.workflowSpec,
    workflowRun,
    workflowInput: clone(workflowRun.input),
    canonicalDisease,
    clinicalService: options.clinicalService,
    storyEngineService: options.storyEngineService,
  });
}

/**
 * @param {any} workflowRun
 * @param {string | undefined} pauseReason
 * @returns {any}
 */
function withPauseReason(workflowRun, pauseReason) {
  const nextWorkflowRun = clone(workflowRun);

  if (pauseReason) {
    nextWorkflowRun.pauseReason = pauseReason;
  } else {
    delete nextWorkflowRun.pauseReason;
  }

  return nextWorkflowRun;
}

/**
 * @param {any} workflowSpec
 * @param {any} workflowRun
 * @param {string} timestamp
 * @param {string} notes
 * @returns {any}
 */
function resetWorkflowForClinicalRebuild(workflowSpec, workflowRun, timestamp, notes) {
  const keepArtifactTypes = new Set([
    'project',
    'canonical-disease',
    'canonicalization-resolution',
  ]);

  return withPauseReason({
    ...workflowRun,
    state: 'running',
    currentStage: 'disease-packet',
    artifacts: workflowRun.artifacts.filter((/** @type {any} */ artifactReference) => keepArtifactTypes.has(artifactReference.artifactType)),
    approvals: workflowRun.requiredApprovalRoles.map((/** @type {string} */ role) => ({
      role,
      decision: 'pending',
    })),
    stages: workflowSpec.stageOrder.map((/** @type {string} */ stageName) => {
      const existingStage = workflowRun.stages.find((/** @type {any} */ stage) => stage.name === stageName);

      if (stageName === 'intake' || stageName === 'canonicalization') {
        return {
          ...existingStage,
          name: stageName,
          status: 'passed',
          startedAt: existingStage?.startedAt ?? workflowRun.createdAt,
          endedAt: existingStage?.endedAt ?? timestamp,
          notes: existingStage?.notes,
        };
      }

      if (stageName === 'disease-packet') {
        return {
          name: stageName,
          status: 'running',
          startedAt: timestamp,
          notes,
        };
      }

      return {
        name: stageName,
        status: 'pending',
      };
    }),
    updatedAt: timestamp,
  }, undefined);
}

/**
 * @param {{
 *   store: PlatformStore,
 *   schemaRegistry: any,
 *   workflowSpec: any,
 *   workflowRun: any,
 *   workflowInput: WorkflowInput,
 *   diseasePacket: any,
 *   storyEngineService: any,
 * }} options
 * @returns {any}
 */
function continueStoryPipeline(options) {
  let workflowRun = withPauseReason(options.workflowRun, undefined);
  const storyWorkbookPackage = options.storyEngineService.generateStoryWorkbookPackage(options.diseasePacket, {
    audienceTier: options.workflowInput.audienceTier,
    styleProfile: options.workflowInput.styleProfile,
    workflowRunId: workflowRun.id,
    existingStoryMemories: listTenantArtifactsByType(options.store, 'story-memory', workflowRun.tenantId),
    timestamp: new Date().toISOString(),
  });

  workflowRun = persistArtifact(
    options.store,
    options.schemaRegistry,
    workflowRun,
    'story-workbook',
    'contracts/story-workbook.schema.json',
    storyWorkbookPackage.storyWorkbook,
  );
  workflowRun = persistArtifact(
    options.store,
    options.schemaRegistry,
    workflowRun,
    'story-memory',
    'contracts/story-memory.schema.json',
    storyWorkbookPackage.storyMemory,
  );
  workflowRun = persistArtifact(
    options.store,
    options.schemaRegistry,
    workflowRun,
    'narrative-review-trace',
    'contracts/narrative-review-trace.schema.json',
    storyWorkbookPackage.narrativeReviewTrace,
  );
  workflowRun = persistArtifact(
    options.store,
    options.schemaRegistry,
    workflowRun,
    'qa-report',
    'contracts/qa-report.schema.json',
    storyWorkbookPackage.qaReport,
    storyWorkbookPackage.qaReport.verdict === 'fail' ? 'rejected' : 'generated',
  );

  if (storyWorkbookPackage.narrativeReviewTrace.verdict === 'fail') {
    return transitionWorkflow(
      options.store,
      options.schemaRegistry,
      options.workflowSpec,
      workflowRun,
      {
        eventType: 'STAGE_FAILED',
        actor: {
          type: 'system',
          id: 'story-workbook-stage',
        },
        payload: {
          storyWorkbookId: storyWorkbookPackage.storyWorkbook.id,
          reviewTraceId: storyWorkbookPackage.narrativeReviewTrace.id,
          qaReportId: storyWorkbookPackage.qaReport.id,
        },
        notes: storyWorkbookPackage.qaReport.blockingIssues.join(' ') || 'Story workbook failed automated narrative review.',
      },
    );
  }

  workflowRun = transitionWorkflow(
    options.store,
    options.schemaRegistry,
    options.workflowSpec,
    workflowRun,
    {
      eventType: 'STAGE_PASSED',
      actor: {
        type: 'system',
        id: 'story-workbook-stage',
      },
      payload: {
        storyWorkbookId: storyWorkbookPackage.storyWorkbook.id,
        storyMemoryId: storyWorkbookPackage.storyMemory.id,
        reviewTraceId: storyWorkbookPackage.narrativeReviewTrace.id,
        qaReportId: storyWorkbookPackage.qaReport.id,
      },
      notes: `Story workbook generated with ${storyWorkbookPackage.narrativeReviewTrace.verdict} automated review.`,
    },
  );

  const visualPlanningPackage = options.storyEngineService.generateVisualPlanningPackage(
    options.diseasePacket,
    storyWorkbookPackage.storyWorkbook,
    storyWorkbookPackage.qaReport,
    {
      workflowRunId: workflowRun.id,
      styleProfile: options.workflowInput.styleProfile,
      timestamp: new Date().toISOString(),
    },
  );

  for (const sceneCard of visualPlanningPackage.sceneCards) {
    workflowRun = persistArtifact(
      options.store,
      options.schemaRegistry,
      workflowRun,
      'scene-card',
      'contracts/scene-card.schema.json',
      sceneCard,
    );
  }

  workflowRun = transitionWorkflow(
    options.store,
    options.schemaRegistry,
    options.workflowSpec,
    workflowRun,
    {
      eventType: 'STAGE_PASSED',
      actor: {
        type: 'system',
        id: 'scene-planning-stage',
      },
      payload: {
        sceneCardIds: visualPlanningPackage.sceneCards.map((/** @type {{ id: string }} */ sceneCard) => sceneCard.id),
      },
      notes: `Generated ${visualPlanningPackage.sceneCards.length} ordered scene cards.`,
    },
  );

  for (const panelPlan of visualPlanningPackage.panelPlans) {
    workflowRun = persistArtifact(
      options.store,
      options.schemaRegistry,
      workflowRun,
      'panel-plan',
      'contracts/panel-plan.schema.json',
      panelPlan,
    );
  }

  workflowRun = transitionWorkflow(
    options.store,
    options.schemaRegistry,
    options.workflowSpec,
    workflowRun,
    {
      eventType: 'STAGE_PASSED',
      actor: {
        type: 'system',
        id: 'panel-planning-stage',
      },
      payload: {
        panelPlanIds: visualPlanningPackage.panelPlans.map((/** @type {{ id: string }} */ panelPlan) => panelPlan.id),
      },
      notes: `Generated ${visualPlanningPackage.panelPlans.length} panel plans with starter redundancy checks.`,
    },
  );

  for (const renderPrompt of visualPlanningPackage.renderPrompts) {
    workflowRun = persistArtifact(
      options.store,
      options.schemaRegistry,
      workflowRun,
      'render-prompt',
      'contracts/render-prompt.schema.json',
      renderPrompt,
    );
  }

  for (const letteringMap of visualPlanningPackage.letteringMaps) {
    workflowRun = persistArtifact(
      options.store,
      options.schemaRegistry,
      workflowRun,
      'lettering-map',
      'contracts/lettering-map.schema.json',
      letteringMap,
    );
  }

  workflowRun = persistArtifact(
    options.store,
    options.schemaRegistry,
    workflowRun,
    'qa-report',
    'contracts/qa-report.schema.json',
    visualPlanningPackage.qaReport,
    visualPlanningPackage.qaReport.verdict === 'fail' ? 'rejected' : 'generated',
  );

  if (visualPlanningPackage.qaReport.verdict === 'fail') {
    return transitionWorkflow(
      options.store,
      options.schemaRegistry,
      options.workflowSpec,
      workflowRun,
      {
        eventType: 'STAGE_FAILED',
        actor: {
          type: 'system',
          id: 'render-prep-stage',
        },
        payload: {
          qaReportId: visualPlanningPackage.qaReport.id,
          blockingIssues: visualPlanningPackage.qaReport.blockingIssues,
        },
        notes: visualPlanningPackage.qaReport.blockingIssues.join(' ') || 'Visual planning failed automated QA.',
      },
    );
  }

  return transitionWorkflow(
    options.store,
    options.schemaRegistry,
    options.workflowSpec,
    workflowRun,
    {
      eventType: 'STAGE_PASSED',
      actor: {
        type: 'system',
        id: 'render-prep-stage',
      },
      payload: {
        renderPromptIds: visualPlanningPackage.renderPrompts.map((/** @type {{ id: string }} */ renderPrompt) => renderPrompt.id),
        letteringMapIds: visualPlanningPackage.letteringMaps.map((/** @type {{ id: string }} */ letteringMap) => letteringMap.id),
        qaReportId: visualPlanningPackage.qaReport.id,
      },
      notes: `Generated ${visualPlanningPackage.renderPrompts.length} render prompts with separate lettering maps.`,
    },
  );
}

/**
 * @param {{
 *   store: PlatformStore,
 *   schemaRegistry: any,
 *   workflowSpec: any,
 *   workflowRun: any,
 *   workflowInput: WorkflowInput,
 *   canonicalDisease: any,
 *   clinicalService: any,
 *   storyEngineService: any,
 * }} options
 * @returns {any}
 */
function continueClinicalStage(options) {
  let workflowRun = withPauseReason(options.workflowRun, undefined);
  const clinicalPackage = buildClinicalPackageForRun({
    store: options.store,
    workflowRun,
    clinicalService: options.clinicalService,
    canonicalDisease: options.canonicalDisease,
  });

  workflowRun = persistClinicalArtifacts({
    store: options.store,
    schemaRegistry: options.schemaRegistry,
    workflowRun,
    clinicalPackage,
  });

  if (clinicalPackage.diseasePacket.evidenceSummary.governanceVerdict === 'blocked') {
    workflowRun = transitionWorkflow(
      options.store,
      options.schemaRegistry,
      options.workflowSpec,
      workflowRun,
      {
        eventType: 'STAGE_FAILED',
        actor: {
          type: 'system',
          id: 'disease-packet-stage',
        },
        payload: {
          diseasePacketId: clinicalPackage.diseasePacket.id,
          evidenceGraphId: clinicalPackage.evidenceGraph.id,
          factTableId: clinicalPackage.factTable.id,
          governanceVerdict: clinicalPackage.diseasePacket.evidenceSummary.governanceVerdict,
        },
        notes: 'Clinical governance blocked the run before story generation could begin.',
      },
    );

    return saveWorkflowRunRecord(
      options.store,
      options.schemaRegistry,
      withPauseReason(workflowRun, 'clinical-governance-blocked'),
    );
  }

  if (clinicalPackage.diseasePacket.evidenceSummary.governanceVerdict === 'review-required') {
    workflowRun = transitionWorkflow(
      options.store,
      options.schemaRegistry,
      options.workflowSpec,
      workflowRun,
      {
        eventType: 'REQUEST_REVIEW',
        actor: {
          type: 'system',
          id: 'disease-packet-stage',
        },
        payload: {
          diseasePacketId: clinicalPackage.diseasePacket.id,
          evidenceGraphId: clinicalPackage.evidenceGraph.id,
          factTableId: clinicalPackage.factTable.id,
          governanceVerdict: clinicalPackage.diseasePacket.evidenceSummary.governanceVerdict,
        },
        notes: 'Clinical governance review is required before story generation can continue.',
      },
    );

    return saveWorkflowRunRecord(
      options.store,
      options.schemaRegistry,
      withPauseReason(workflowRun, 'clinical-governance-review-required'),
    );
  }

  workflowRun = transitionWorkflow(
    options.store,
    options.schemaRegistry,
    options.workflowSpec,
    withPauseReason(workflowRun, undefined),
    {
      eventType: 'STAGE_PASSED',
      actor: {
        type: 'system',
        id: 'disease-packet-stage',
      },
      payload: {
        canonicalDiseaseId: options.canonicalDisease.id,
        diseasePacketId: clinicalPackage.diseasePacket.id,
        evidenceGraphId: clinicalPackage.evidenceGraph.id,
        factTableId: clinicalPackage.factTable.id,
      },
      notes: 'Clinical package generated and approved for downstream story work.',
    },
  );

  return continueStoryPipeline({
    store: options.store,
    schemaRegistry: options.schemaRegistry,
    workflowSpec: options.workflowSpec,
    workflowRun,
    workflowInput: options.workflowInput,
    diseasePacket: clinicalPackage.diseasePacket,
    storyEngineService: options.storyEngineService,
  });
}

/**
 * @param {{
 *   store: PlatformStore,
 *   schemaRegistry: any,
 *   workflowSpec: any,
 *   workflowRun: any,
 *   workflowInput: WorkflowInput,
 *   canonicalDisease: any,
 *   clinicalService: any,
 *   storyEngineService: any,
 * }} options
 * @returns {any}
 */
function continueResolvedPipeline(options) {
  let workflowRun = options.workflowRun;

  workflowRun = transitionWorkflow(
    options.store,
    options.schemaRegistry,
    options.workflowSpec,
    workflowRun,
    {
      eventType: 'STAGE_PASSED',
      actor: {
        type: 'system',
        id: 'canonicalization-stage',
      },
      payload: {
        canonicalDiseaseId: options.canonicalDisease.id,
      },
      notes: `Canonical disease resolved to ${options.canonicalDisease.canonicalDiseaseName}.`,
    },
  );

  return continueClinicalStage({
    store: options.store,
    schemaRegistry: options.schemaRegistry,
    workflowSpec: options.workflowSpec,
    workflowRun,
    workflowInput: options.workflowInput,
    canonicalDisease: options.canonicalDisease,
    clinicalService: options.clinicalService,
    storyEngineService: options.storyEngineService,
  });
}

/**
 * @param {{
 *   store: PlatformStore,
 *   schemaRegistry: any,
 *   workflowSpec: any,
 *   workflowRun: any,
 *   actor: any,
 *   role: string,
 *   decision: string,
 *   comment?: string,
 * }} options
 * @returns {any}
 */
function submitApproval(options) {
  if (options.workflowRun.state !== 'review') {
    throw createHttpError(409, 'Workflow run is not awaiting approvals.');
  }

  if (!canSubmitApproval(options.actor, options.role)) {
    denyWithAudit(
      options.store,
      options.schemaRegistry,
      options.actor,
      'approval.submit',
      'workflow-run',
      options.workflowRun.id,
      `Actor cannot submit ${options.role} approvals.`,
    );
  }

  let workflowRun = transitionWorkflow(
    options.store,
    options.schemaRegistry,
    options.workflowSpec,
    options.workflowRun,
    {
      eventType: 'RECORD_APPROVAL',
      actor: {
        type: 'user',
        id: options.actor.id,
      },
      payload: {
        role: options.role,
        reviewerId: options.actor.id,
        decision: options.decision,
        comment: options.comment,
      },
    },
  );

  appendAuditLog(
    options.store,
    options.schemaRegistry,
    options.actor,
    'approval.submit',
    'workflow-run',
    workflowRun.id,
    'success',
    `Recorded ${options.role} approval as ${options.decision}.`,
    {
      comment: options.comment,
      decision: options.decision,
      role: options.role,
    },
  );

  if (workflowRun.state === 'review' && areRequiredApprovalsApproved(workflowRun)) {
    workflowRun = transitionWorkflow(
      options.store,
      options.schemaRegistry,
      options.workflowSpec,
      workflowRun,
      {
        eventType: 'APPROVALS_COMPLETED',
        actor: {
          type: 'system',
          id: 'approval-gate',
        },
        payload: {
          rolesApproved: workflowRun.requiredApprovalRoles,
        },
      },
    );
  }

  return workflowRun;
}

/**
 * @param {{
 *   store: PlatformStore,
 *   schemaRegistry: any,
 *   workflowSpec: any,
 *   clinicalService: any,
 *   storyEngineService: any,
 *   workflowRun: any,
 *   actor: any,
 *   selectedCanonicalDiseaseName: string,
 *   reason: string,
 * }} options
 * @returns {any}
 */
function resolveCanonicalizationForRun(options) {
  if (options.workflowRun.currentStage !== 'canonicalization' || options.workflowRun.state !== 'failed') {
    throw createHttpError(409, 'Workflow run is not waiting on canonicalization resolution.');
  }

  if (!canResolveCanonicalization(options.actor)) {
    denyWithAudit(
      options.store,
      options.schemaRegistry,
      options.actor,
      'canonicalization.resolve',
      'workflow-run',
      options.workflowRun.id,
      'Actor cannot resolve canonicalization blockers.',
    );
  }

  const originalArtifactReference = findLatestArtifactReference(options.workflowRun, 'canonical-disease');

  if (!originalArtifactReference) {
    throw createHttpError(409, 'No canonical disease artifact is attached to this workflow run.');
  }

  const originalCanonicalDisease = options.store.getArtifact('canonical-disease', originalArtifactReference.artifactId);

  if (!originalCanonicalDisease) {
    throw createHttpError(404, 'Original canonical disease artifact could not be loaded.');
  }

  const resolvedPackage = options.clinicalService.resolveCanonicalization(
    originalCanonicalDisease,
    options.selectedCanonicalDiseaseName,
  );

  let workflowRun = persistArtifact(
    options.store,
    options.schemaRegistry,
    options.workflowRun,
    'canonical-disease',
    'contracts/canonical-disease.schema.json',
    resolvedPackage.canonicalDisease,
    'approved',
  );

  const canonicalizationResolution = {
    schemaVersion: SCHEMA_VERSION,
    id: createId('crs'),
    workflowRunId: workflowRun.id,
    originalCanonicalDiseaseId: originalCanonicalDisease.id,
    resolvedCanonicalDiseaseId: resolvedPackage.canonicalDisease.id,
    selectedCanonicalDiseaseName: resolvedPackage.canonicalDisease.canonicalDiseaseName,
    selectedOntologyId: resolvedPackage.canonicalDisease.ontologyId,
    resolutionMode: resolvedPackage.resolutionMode,
    reviewerId: options.actor.id,
    reviewerRoles: [...options.actor.roles],
    reason: options.reason,
    occurredAt: new Date().toISOString(),
  };

  workflowRun = persistArtifact(
    options.store,
    options.schemaRegistry,
    workflowRun,
    'canonicalization-resolution',
    'contracts/canonicalization-resolution.schema.json',
    canonicalizationResolution,
    'approved',
  );

  workflowRun = transitionWorkflow(
    options.store,
    options.schemaRegistry,
    options.workflowSpec,
    workflowRun,
    {
      eventType: 'RETRY_STAGE',
      actor: {
        type: 'user',
        id: options.actor.id,
      },
      payload: {
        resolutionId: canonicalizationResolution.id,
      },
      notes: options.reason,
    },
  );

  workflowRun = continueResolvedPipeline({
    store: options.store,
    schemaRegistry: options.schemaRegistry,
    workflowSpec: options.workflowSpec,
    workflowRun,
    workflowInput: clone(workflowRun.input),
    canonicalDisease: resolvedPackage.canonicalDisease,
    clinicalService: options.clinicalService,
    storyEngineService: options.storyEngineService,
  });

  appendAuditLog(
    options.store,
    options.schemaRegistry,
    options.actor,
    'canonicalization.resolve',
    'workflow-run',
    workflowRun.id,
    'success',
    options.reason,
    {
      originalCanonicalDiseaseId: originalCanonicalDisease.id,
      resolutionId: canonicalizationResolution.id,
      resolvedCanonicalDiseaseId: resolvedPackage.canonicalDisease.id,
    },
  );

  return workflowRun;
}

/**
 * @param {any} workflowRun
 * @param {string} artifactType
 * @returns {any}
 */
function markLatestEvalPossiblyStale(workflowRun, artifactType) {
  if (!workflowRun.latestEvalRunId) {
    return workflowRun;
  }

  if (artifactType === 'eval-run' || artifactType === 'release-bundle') {
    return workflowRun;
  }

  return {
    ...workflowRun,
    latestEvalStatus: 'stale',
  };
}

/**
 * @param {any} workflowRun
 * @param {any} evalRun
 * @param {'passed' | 'failed' | 'stale' | 'missing'} status
 * @returns {any}
 */
function applyLatestEvalMetadata(workflowRun, evalRun, status) {
  return {
    ...workflowRun,
    latestEvalRunId: evalRun?.id ?? null,
    latestEvalStatus: status,
    latestEvalAt: evalRun?.evaluatedAt ?? null,
  };
}

/**
 * @param {PlatformStore} store
 * @param {any} workflowRun
 * @returns {any | null}
 */
function getLatestEvalRun(store, workflowRun) {
  const latestEvaluationReference = listEvaluationReferences(workflowRun).at(-1);

  return latestEvaluationReference
    ? store.getArtifact('eval-run', latestEvaluationReference.artifactId)
    : null;
}

/**
 * @param {PlatformStore} store
 * @param {any} workflowRun
 * @returns {string}
 */
function getLatestEvalStatus(store, workflowRun) {
  return deriveEvalStatus(getLatestEvalRun(store, workflowRun), store, workflowRun);
}

/**
 * @param {PlatformStore} store
 * @param {any} workflowRun
 * @returns {Map<string, Array<{ artifactType: string, artifactId: string, artifact: any }>>}
 */
function groupArtifactsForRun(store, workflowRun) {
  const groupedArtifacts = new Map();

  for (const artifactReference of workflowRun.artifacts) {
    const artifact = loadArtifactByReference(store, artifactReference);

    if (!artifact) {
      continue;
    }

    const entries = groupedArtifacts.get(artifactReference.artifactType) ?? [];
    entries.push({
      artifactType: artifactReference.artifactType,
      artifactId: artifactReference.artifactId,
      artifact,
    });
    groupedArtifacts.set(artifactReference.artifactType, entries);
  }

  return groupedArtifacts;
}

/**
 * @param {PlatformStore} store
 * @param {any} workflowRun
 * @returns {Array<{ title: string, description?: string, artifacts: Array<{ artifactType: string, artifactId: string, artifact: any }> }>}
 */
function buildReviewArtifactGroups(store, workflowRun) {
  const groupedArtifacts = groupArtifactsForRun(store, workflowRun);

  return [
    {
      title: 'Disease packet summary',
      description: 'Canonical disease context and the persisted packet summary.',
      artifacts: [
        ...(groupedArtifacts.get('canonical-disease') ?? []),
        ...(groupedArtifacts.get('canonicalization-resolution') ?? []),
        ...(groupedArtifacts.get('disease-packet') ?? []),
      ],
    },
    {
      title: 'Fact table',
      description: 'Claim-level clinical fact rows and support status.',
      artifacts: groupedArtifacts.get('fact-table') ?? [],
    },
    {
      title: 'Evidence graph',
      description: 'Structured support and contradiction edges across claims.',
      artifacts: groupedArtifacts.get('evidence-graph') ?? [],
    },
    {
      title: 'Clinical teaching points',
      artifacts: groupedArtifacts.get('clinical-teaching-points') ?? [],
    },
    {
      title: 'Visual anchor catalog',
      artifacts: groupedArtifacts.get('visual-anchor-catalog') ?? [],
    },
    {
      title: 'Story workbook and narrative review trace',
      description: 'Workbook logic, novelty memory, and automated narrative review.',
      artifacts: [
        ...(groupedArtifacts.get('story-workbook') ?? []),
        ...(groupedArtifacts.get('story-memory') ?? []),
        ...(groupedArtifacts.get('narrative-review-trace') ?? []),
      ],
    },
    {
      title: 'Scene cards',
      artifacts: groupedArtifacts.get('scene-card') ?? [],
    },
    {
      title: 'Panel plans',
      artifacts: groupedArtifacts.get('panel-plan') ?? [],
    },
    {
      title: 'Render prompts',
      artifacts: groupedArtifacts.get('render-prompt') ?? [],
    },
    {
      title: 'Lettering maps',
      artifacts: groupedArtifacts.get('lettering-map') ?? [],
    },
    {
      title: 'QA reports',
      artifacts: groupedArtifacts.get('qa-report') ?? [],
    },
  ];
}

/**
 * @param {any[]} workflowRuns
 * @param {Map<string, any>} projectsById
 * @param {Map<string, { exportCount: number, latestEvalStatus: string }>} runSummaries
 * @param {{ disease?: string, state?: string, stage?: string, exportStatus?: string, evalStatus?: string, sort?: string }} filters
 * @returns {any[]}
 */
function filterAndSortWorkflowRuns(workflowRuns, projectsById, runSummaries, filters) {
  const diseaseFilter = filters.disease?.trim().toLowerCase() ?? '';
  const filteredRuns = workflowRuns.filter((workflowRun) => {
    const project = projectsById.get(workflowRun.projectId);
    const diseaseName = (workflowRun.input?.diseaseName ?? project?.input?.diseaseName ?? '').toLowerCase();
    const runSummary = runSummaries.get(workflowRun.id) ?? {
      exportCount: 0,
      latestEvalStatus: 'missing',
    };

    if (diseaseFilter && !diseaseName.includes(diseaseFilter)) {
      return false;
    }

    if (filters.state && workflowRun.state !== filters.state) {
      return false;
    }

    if (filters.stage && workflowRun.currentStage !== filters.stage) {
      return false;
    }

    if (filters.exportStatus === 'with-exports' && runSummary.exportCount === 0) {
      return false;
    }

    if (filters.exportStatus === 'without-exports' && runSummary.exportCount > 0) {
      return false;
    }

    if (filters.evalStatus && runSummary.latestEvalStatus !== filters.evalStatus) {
      return false;
    }

    return true;
  });

  const sortKey = filters.sort ?? 'updated-desc';
  const sortedRuns = [...filteredRuns];

  sortedRuns.sort((left, right) => {
    const leftProject = projectsById.get(left.projectId);
    const rightProject = projectsById.get(right.projectId);
    const leftSummary = runSummaries.get(left.id) ?? { exportCount: 0, latestEvalStatus: 'missing' };
    const rightSummary = runSummaries.get(right.id) ?? { exportCount: 0, latestEvalStatus: 'missing' };

    switch (sortKey) {
      case 'disease-asc':
        return (left.input?.diseaseName ?? leftProject?.input?.diseaseName ?? '').localeCompare(
          right.input?.diseaseName ?? rightProject?.input?.diseaseName ?? '',
        );
      case 'state-asc':
        return left.state.localeCompare(right.state);
      case 'stage-asc':
        return left.currentStage.localeCompare(right.currentStage);
      case 'exports-desc':
        return rightSummary.exportCount - leftSummary.exportCount;
      case 'eval-status':
        return leftSummary.latestEvalStatus.localeCompare(rightSummary.latestEvalStatus);
      default:
        return right.updatedAt.localeCompare(left.updatedAt);
    }
  });

  return sortedRuns;
}

/**
 * @param {{ store: PlatformStore, schemaRegistry: any, evalService: any, workflowRun: any, actor: any }} options
 * @returns {any}
 */
function evaluateWorkflowRun(options) {
  const evalRun = options.evalService.runForWorkflowRun({
    store: options.store,
    workflowRun: options.workflowRun,
    actor: options.actor,
  });

  assertSchema(options.schemaRegistry, 'contracts/eval-run.schema.json', evalRun);
  let workflowRun = persistArtifact(
    options.store,
    options.schemaRegistry,
    options.workflowRun,
    'eval-run',
    'contracts/eval-run.schema.json',
    evalRun,
    evalRun.summary.allThresholdsMet ? 'approved' : 'rejected',
  );
  const latestEvalStatus = deriveEvalStatus(evalRun, options.store, workflowRun);

  workflowRun = applyLatestEvalMetadata(workflowRun, evalRun, latestEvalStatus);
  workflowRun = {
    ...workflowRun,
    updatedAt: new Date().toISOString(),
  };
  assertSchema(options.schemaRegistry, 'contracts/workflow-run.schema.json', workflowRun);
  options.store.saveWorkflowRun(workflowRun);
  appendAuditLog(
    options.store,
    options.schemaRegistry,
    options.actor,
    'workflow-run.evaluate',
    'workflow-run',
    workflowRun.id,
    'success',
    `Executed eval run ${evalRun.id}.`,
    {
      allThresholdsMet: evalRun.summary.allThresholdsMet,
      evalRunId: evalRun.id,
    },
  );

  return workflowRun;
}

/**
 * @param {{
 *   store: PlatformStore,
 *   schemaRegistry: any,
 *   workflowSpec: any,
 *   exporterService: any,
 *   workflowRun: any,
 *   actor: any,
 *   project: any,
 *   version?: string,
 *   exportTargets?: string[],
 * }} options
 * @returns {{ workflowRun: any, releaseBundle: any, exportHistoryEntry: any }}
 */
function exportWorkflowRun(options) {
  if (!canExportRun(options.actor)) {
    denyWithAudit(
      options.store,
      options.schemaRegistry,
      options.actor,
      'workflow-run.export',
      'workflow-run',
      options.workflowRun.id,
      'Actor cannot export workflow runs.',
    );
  }

  const diseasePacketReference = findLatestArtifactReference(options.workflowRun, 'disease-packet');

  if (!diseasePacketReference) {
    throw createHttpError(409, 'Workflow run is missing a disease packet required for export.');
  }

  const diseasePacket = options.store.getArtifact('disease-packet', diseasePacketReference.artifactId);

  if (!diseasePacket) {
    throw createHttpError(404, 'Disease packet artifact could not be loaded.');
  }

  const latestEvalRun = getLatestEvalRun(options.store, options.workflowRun);
  const latestEvalStatus = deriveEvalStatus(latestEvalRun, options.store, options.workflowRun);

  if (!latestEvalRun) {
    throw createHttpError(409, 'Export requires a persisted eval run for this workflow run.');
  }

  if (latestEvalStatus === 'stale') {
    throw createHttpError(409, 'Export requires a fresh eval run created after the latest artifact update.');
  }

  if (latestEvalStatus !== 'passed') {
    throw createHttpError(409, 'Export requires the latest eval run to pass all applicable thresholds.');
  }

  const qaReports = options.workflowRun.artifacts
    .filter((/** @type {{ artifactType: string }} */ artifact) => artifact.artifactType === 'qa-report')
    .map((/** @type {{ artifactType: string, artifactId: string }} */ artifact) => options.store.getArtifact(artifact.artifactType, artifact.artifactId))
    .filter(Boolean);
  const releasePackage = options.exporterService.assembleRelease({
    workflowRun: options.workflowRun,
    project: options.project,
    actor: options.actor,
    diseasePacket,
    qaReports,
    artifactManifest: collectReleaseArtifactManifest(options.store, options.workflowRun),
    evaluationSummary: summarizeEvalRun(latestEvalRun),
    exportTargets: options.exportTargets,
    version: options.version,
  });

  const sourceEvidencePackDocument = options.store.saveDocument(
    'source-evidence-pack',
    releasePackage.releaseBundle.releaseId,
    JSON.stringify(releasePackage.sourceEvidencePack, null, 2),
    {
      tenantId: options.workflowRun.tenantId,
      contentType: 'application/json',
      extension: 'json',
      retentionClass: 'release-bundle',
    },
  );
  const bundleIndexDocument = options.store.saveDocument(
    'release-index',
    releasePackage.releaseBundle.releaseId,
    releasePackage.bundleIndexMarkdown,
    {
      tenantId: options.workflowRun.tenantId,
      contentType: 'text/markdown',
      extension: 'md',
      retentionClass: 'release-bundle',
    },
  );

  releasePackage.releaseBundle.bundleIndexLocation = bundleIndexDocument.location;
  releasePackage.releaseBundle.sourceEvidencePackLocation = sourceEvidencePackDocument.location;
  let workflowRun = persistArtifact(
    options.store,
    options.schemaRegistry,
    options.workflowRun,
    'release-bundle',
    'contracts/release-bundle.schema.json',
    releasePackage.releaseBundle,
    'exported',
  );
  const releaseBundleMetadata = options.store.getArtifactMetadata('release-bundle', releasePackage.releaseBundle.releaseId);

  if (!releaseBundleMetadata) {
    throw createHttpError(500, 'Release bundle metadata was not stored.');
  }

  const exportHistoryEntry = {
    ...releasePackage.exportHistoryEntry,
    evalRunId: latestEvalRun.id,
    bundleLocation: releaseBundleMetadata.location,
    bundleIndexLocation: bundleIndexDocument.location,
  };
  assertSchema(options.schemaRegistry, 'contracts/export-history-entry.schema.json', exportHistoryEntry);
  options.store.saveExportHistoryEntry(exportHistoryEntry);

  workflowRun = transitionWorkflow(options.store, options.schemaRegistry, options.workflowSpec, workflowRun, {
    eventType: 'START_EXPORT',
    actor: {
      type: 'user',
      id: options.actor.id,
    },
    payload: {
      releaseId: releasePackage.releaseBundle.releaseId,
    },
    notes: 'Release bundle assembly started.',
  });

  workflowRun = transitionWorkflow(options.store, options.schemaRegistry, options.workflowSpec, workflowRun, {
    eventType: 'EXPORT_COMPLETED',
    actor: {
      type: 'system',
      id: 'export-service',
    },
    payload: {
      releaseId: releasePackage.releaseBundle.releaseId,
      exportHistoryEntryId: exportHistoryEntry.id,
    },
    notes: 'Release bundle exported and stored in local object storage.',
  });

  workflowRun = applyLatestEvalMetadata(workflowRun, latestEvalRun, latestEvalStatus);
  workflowRun = {
    ...workflowRun,
    updatedAt: new Date().toISOString(),
  };
  assertSchema(options.schemaRegistry, 'contracts/workflow-run.schema.json', workflowRun);
  options.store.saveWorkflowRun(workflowRun);
  appendAuditLog(
    options.store,
    options.schemaRegistry,
    options.actor,
    'workflow-run.export',
    'workflow-run',
    workflowRun.id,
    'success',
    `Exported release bundle ${releasePackage.releaseBundle.releaseId}.`,
    {
      evalRunId: latestEvalRun.id,
      exportHistoryEntryId: exportHistoryEntry.id,
      releaseId: releasePackage.releaseBundle.releaseId,
    },
  );

  return {
    workflowRun,
    releaseBundle: releasePackage.releaseBundle,
    exportHistoryEntry,
  };
}

/**
 * @param {PlatformStore} store
 * @param {any} schemaRegistry
 * @param {any} workflowRun
 * @returns {any}
 */
function syncLatestEvalMetadata(store, schemaRegistry, workflowRun) {
  const latestEvalRun = getLatestEvalRun(store, workflowRun);
  const latestEvalStatus = deriveEvalStatus(latestEvalRun, store, workflowRun);
  const nextWorkflowRun = latestEvalRun
    ? applyLatestEvalMetadata(workflowRun, latestEvalRun, latestEvalStatus)
    : workflowRun;

  if (
    nextWorkflowRun.latestEvalRunId !== workflowRun.latestEvalRunId
    || nextWorkflowRun.latestEvalStatus !== workflowRun.latestEvalStatus
    || nextWorkflowRun.latestEvalAt !== workflowRun.latestEvalAt
  ) {
    assertSchema(schemaRegistry, 'contracts/workflow-run.schema.json', nextWorkflowRun);
    store.saveWorkflowRun(nextWorkflowRun);
    return nextWorkflowRun;
  }

  return workflowRun;
}

/**
 * @param {{ rootDir?: string, store?: PlatformStore, dbFilePath?: string, objectStoreDir?: string }} [options]
 * @returns {Promise<{ server: import('node:http').Server, store: PlatformStore }>}
 */
export async function createApp(options = {}) {
  const rootDir = options.rootDir ?? findRepoRoot(import.meta.url);
  const dbFilePath = options.dbFilePath ?? process.env.PLATFORM_DB_FILE ?? path.join(rootDir, 'var', 'db', 'platform.sqlite');
  const objectStoreDir = options.objectStoreDir ?? process.env.OBJECT_STORE_DIR ?? path.join(rootDir, 'var', 'object-store');
  const store = options.store ?? new PlatformStore({
    rootDir,
    dbFilePath,
    objectStoreDir,
  });
  const schemaRegistry = await createSchemaRegistry(rootDir);
  const workflowSpec = await loadWorkflowSpec(rootDir);
  const clinicalService = createClinicalRetrievalService();
  const storyEngineService = createStoryEngineService();
  const exporterService = createExporterService();
  const evalService = createEvalService({
    rootDir,
    exporterService,
  });

  const server = createServer(async (request, response) => {
    try {
      const method = request.method ?? 'GET';
      const requestUrl = createRequestUrl(request.url ?? '/');
      const { pathname } = requestUrl;
      const actor = getActorFromRequest();

      if (!requireLocalActor(actor, response)) {
        return;
      }

      if (method === 'GET' && pathname === '/') {
        redirect(response, '/review');
        return;
      }

      if (method === 'GET' && pathname === '/intake') {
        sendHtml(response, 200, renderIntakePage({ actor }));
        return;
      }

      if (method === 'GET' && pathname === '/review') {
        if (!canViewTenantData(actor)) {
          throw createHttpError(403, 'Actor cannot open review pages.');
        }

        const accessibleProjects = store.listProjects().filter((project) => canAccessTenant(actor, getTenantId(project)));
        const accessibleWorkflowRuns = store.listWorkflowRuns()
          .filter((workflowRun) => canAccessTenant(actor, getTenantId(workflowRun)))
        const projectsById = new Map(accessibleProjects.map((project) => [project.id, project]));
        const runSummaries = new Map(accessibleWorkflowRuns.map((workflowRun) => {
          const syncedWorkflowRun = syncLatestEvalMetadata(store, schemaRegistry, workflowRun);
          return [syncedWorkflowRun.id, {
            exportCount: store.listExportHistoryEntries(syncedWorkflowRun.id).length,
            latestEvalStatus: getLatestEvalStatus(store, syncedWorkflowRun),
          }];
        }));
        const filters = {
          disease: requestUrl.searchParams.get('disease') ?? '',
          state: requestUrl.searchParams.get('state') ?? '',
          stage: requestUrl.searchParams.get('stage') ?? '',
          exportStatus: requestUrl.searchParams.get('exportStatus') ?? '',
          evalStatus: requestUrl.searchParams.get('evalStatus') ?? '',
          sort: requestUrl.searchParams.get('sort') ?? 'updated-desc',
        };

        sendHtml(response, 200, renderReviewDashboard({
          actor,
          workflowRuns: filterAndSortWorkflowRuns(accessibleWorkflowRuns, projectsById, runSummaries, filters),
          projectsById,
          filters,
          runSummaries,
        }));
        return;
      }

      const reviewRunPath = matchReviewRunPath(pathname);

      if (method === 'GET' && reviewRunPath) {
        let workflowRun = store.getWorkflowRun(reviewRunPath.runId);

        if (!workflowRun) {
          throw createHttpError(404, 'Workflow run not found.');
        }

        workflowRun = syncLatestEvalMetadata(store, schemaRegistry, workflowRun);
        const project = getProjectForRun(store, workflowRun);
        assertTenantAccess(actor, getTenantId(workflowRun), store, schemaRegistry, 'review.view', 'workflow-run', workflowRun.id);

        const canonicalArtifactReference = findLatestArtifactReference(workflowRun, 'canonical-disease');
        const canonicalDisease = canonicalArtifactReference
          ? store.getArtifact('canonical-disease', canonicalArtifactReference.artifactId)
          : null;
        const clinicalPackage = loadClinicalPackageForRun({
          store,
          workflowRun,
          clinicalService,
        });
        const approvableRoles = workflowRun.requiredApprovalRoles.filter(
          (/** @type {string} */ role) => canSubmitApproval(actor, role),
        );

        sendHtml(response, 200, renderReviewRunPage({
          actor,
          project,
          workflowRun,
          artifactGroups: buildReviewArtifactGroups(store, workflowRun),
          auditLogs: store.listAuditLogEntries({ subjectId: workflowRun.id, subjectType: 'workflow-run' }),
          canonicalDisease,
          canResolveCanonicalization: canResolveCanonicalization(actor),
          approvableRoles,
          clinicalPackage,
          latestEvalRun: getLatestEvalRun(store, workflowRun),
          latestEvalStatus: getLatestEvalStatus(store, workflowRun),
          exportHistory: store.listExportHistoryEntries(workflowRun.id),
        }));
        return;
      }

      const reviewRunApprovalActionPath = matchReviewRunApprovalActionPath(pathname);

      if (method === 'POST' && reviewRunApprovalActionPath) {
        const workflowRun = store.getWorkflowRun(reviewRunApprovalActionPath.runId);

        if (!workflowRun) {
          throw createHttpError(404, 'Workflow run not found.');
        }

        assertTenantAccess(actor, getTenantId(workflowRun), store, schemaRegistry, 'approval.submit', 'workflow-run', workflowRun.id);
        const body = await readFormBody(request);
        submitApproval({
          store,
          schemaRegistry,
          workflowSpec,
          workflowRun,
          actor,
          role: body.role,
          decision: body.decision,
          comment: body.comment,
        });
        redirect(response, `/review/runs/${encodeURIComponent(workflowRun.id)}`);
        return;
      }

      const reviewRunCanonicalizationActionPath = matchReviewRunCanonicalizationActionPath(pathname);

      if (method === 'POST' && reviewRunCanonicalizationActionPath) {
        const workflowRun = store.getWorkflowRun(reviewRunCanonicalizationActionPath.runId);

        if (!workflowRun) {
          throw createHttpError(404, 'Workflow run not found.');
        }

        assertTenantAccess(actor, getTenantId(workflowRun), store, schemaRegistry, 'canonicalization.resolve', 'workflow-run', workflowRun.id);
        const body = await readFormBody(request);

        resolveCanonicalizationForRun({
          store,
          schemaRegistry,
          workflowSpec,
          clinicalService,
          storyEngineService,
          workflowRun,
          actor,
          selectedCanonicalDiseaseName: body.selectedCanonicalDiseaseName,
          reason: body.reason,
        });
        redirect(response, `/review/runs/${encodeURIComponent(workflowRun.id)}`);
        return;
      }

      const reviewRunEvaluationActionPath = matchReviewRunEvaluationActionPath(pathname);

      if (method === 'POST' && reviewRunEvaluationActionPath) {
        const workflowRun = store.getWorkflowRun(reviewRunEvaluationActionPath.runId);

        if (!workflowRun) {
          throw createHttpError(404, 'Workflow run not found.');
        }

        assertTenantAccess(actor, getTenantId(workflowRun), store, schemaRegistry, 'workflow-run.evaluate', 'workflow-run', workflowRun.id);
        evaluateWorkflowRun({
          store,
          schemaRegistry,
          evalService,
          workflowRun,
          actor,
        });
        redirect(response, `/review/runs/${encodeURIComponent(workflowRun.id)}`);
        return;
      }

      const reviewRunClinicalPackageRebuildActionPath = matchReviewRunClinicalPackageRebuildActionPath(pathname);

      if (method === 'POST' && reviewRunClinicalPackageRebuildActionPath) {
        const workflowRun = store.getWorkflowRun(reviewRunClinicalPackageRebuildActionPath.runId);

        if (!workflowRun) {
          throw createHttpError(404, 'Workflow run not found.');
        }

        assertTenantAccess(actor, getTenantId(workflowRun), store, schemaRegistry, 'clinical-package.rebuild', 'workflow-run', workflowRun.id);
        const body = await readFormBody(request);

        rebuildClinicalPackageForRun({
          store,
          schemaRegistry,
          workflowSpec,
          clinicalService,
          storyEngineService,
          workflowRun,
          actor,
          reason: body.reason,
        });
        redirect(response, `/review/runs/${encodeURIComponent(workflowRun.id)}`);
        return;
      }

      const reviewRunSourceGovernanceActionPath = matchReviewRunSourceGovernanceActionPath(pathname);

      if (method === 'POST' && reviewRunSourceGovernanceActionPath) {
        const workflowRun = store.getWorkflowRun(reviewRunSourceGovernanceActionPath.runId);

        if (!workflowRun) {
          throw createHttpError(404, 'Workflow run not found.');
        }

        assertTenantAccess(actor, getTenantId(workflowRun), store, schemaRegistry, 'source-governance.record', 'workflow-run', workflowRun.id);
        const clinicalPackage = loadClinicalPackageForRun({
          store,
          workflowRun,
          clinicalService,
        });

        if (!clinicalPackage) {
          throw createHttpError(409, 'No clinical package is available for this workflow run yet.');
        }

        const sourceRecord = clinicalPackage.sourceRecords.find((/** @type {any} */ entry) => entry.id === reviewRunSourceGovernanceActionPath.sourceId);

        if (!sourceRecord) {
          throw createHttpError(404, 'Source record not found for this workflow run.');
        }

        const body = await readFormBody(request);
        saveSourceGovernanceDecision({
          store,
          schemaRegistry,
          workflowRun,
          actor,
          canonicalDiseaseName: clinicalPackage.diseasePacket.canonicalDiseaseName,
          sourceId: sourceRecord.id,
          decision: body.decision,
          reason: body.reason,
          notes: body.reason ? [body.reason] : [],
        });
        redirect(response, `/review/runs/${encodeURIComponent(workflowRun.id)}`);
        return;
      }

      const reviewRunContradictionResolutionActionPath = matchReviewRunContradictionResolutionActionPath(pathname);

      if (method === 'POST' && reviewRunContradictionResolutionActionPath) {
        const workflowRun = store.getWorkflowRun(reviewRunContradictionResolutionActionPath.runId);

        if (!workflowRun) {
          throw createHttpError(404, 'Workflow run not found.');
        }

        assertTenantAccess(actor, getTenantId(workflowRun), store, schemaRegistry, 'contradiction-resolution.record', 'workflow-run', workflowRun.id);
        const clinicalPackage = loadClinicalPackageForRun({
          store,
          workflowRun,
          clinicalService,
        });

        if (!clinicalPackage) {
          throw createHttpError(409, 'No clinical package is available for this workflow run yet.');
        }

        const evidenceRecord = clinicalPackage.evidenceRecords.find((/** @type {any} */ entry) => entry.claimId === reviewRunContradictionResolutionActionPath.claimId);

        if (!evidenceRecord) {
          throw createHttpError(404, 'Evidence record not found for this workflow run.');
        }

        const body = await readFormBody(request);
        saveContradictionResolution({
          store,
          schemaRegistry,
          workflowRun,
          actor,
          canonicalDiseaseName: clinicalPackage.diseasePacket.canonicalDiseaseName,
          claimId: evidenceRecord.claimId,
          relatedClaimId: body.relatedClaimId || undefined,
          status: body.status,
          reason: body.reason,
        });
        redirect(response, `/review/runs/${encodeURIComponent(workflowRun.id)}`);
        return;
      }

      const reviewRunExportActionPath = matchReviewRunExportActionPath(pathname);

      if (method === 'POST' && reviewRunExportActionPath) {
        const workflowRun = store.getWorkflowRun(reviewRunExportActionPath.runId);

        if (!workflowRun) {
          throw createHttpError(404, 'Workflow run not found.');
        }

        assertTenantAccess(actor, getTenantId(workflowRun), store, schemaRegistry, 'workflow-run.export', 'workflow-run', workflowRun.id);
        const project = getProjectForRun(store, workflowRun);
        const body = await readFormBody(request);
        exportWorkflowRun({
          store,
          schemaRegistry,
          workflowSpec,
          exporterService,
          workflowRun,
          actor,
          project,
          version: body.version || undefined,
        });
        redirect(response, `/review/runs/${encodeURIComponent(workflowRun.id)}`);
        return;
      }

      if (method === 'POST' && pathname === '/api/v1/projects') {
        if (!canCreateProject(actor)) {
          denyWithAudit(store, schemaRegistry, actor, 'project.create', 'project', 'unknown', 'Actor cannot create projects.');
        }

        const body = await readJsonBody(request);
        const validation = validatePayload(schemaRegistry, 'contracts/disease-intake-request.schema.json', body);

        if (!validation.valid || !isRecord(body)) {
          throw createHttpError(400, 'Disease intake request is invalid.', validation.error);
        }

        const intakeRequest = toDiseaseIntakeRequest(body);
        const timestamp = new Date().toISOString();
        const project = {
          schemaVersion: SCHEMA_VERSION,
          id: createId('prj'),
          tenantId: actor.tenantId ?? getDefaultTenantId(),
          title: intakeRequest.title ?? defaultProjectTitle(intakeRequest.diseaseName),
          status: 'active',
          input: toWorkflowInput(intakeRequest),
          activeWorkflowRunId: null,
          workflowRunIds: [],
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        assertSchema(schemaRegistry, 'contracts/project.schema.json', project);
        store.saveProject(project);
        appendAuditLog(
          store,
          schemaRegistry,
          actor,
          'project.create',
          'project',
          project.id,
          'success',
          'Created project from disease intake request.',
          {
            diseaseName: project.input.diseaseName,
            tenantId: project.tenantId,
          },
        );
        sendJson(response, 201, project);
        return;
      }

      const projectPath = matchProjectPath(pathname);

      if (method === 'GET' && projectPath) {
        const project = store.getProject(projectPath.projectId);

        if (!project) {
          throw createHttpError(404, 'Project not found.');
        }

        assertTenantAccess(actor, getTenantId(project), store, schemaRegistry, 'project.view', 'project', project.id);
        assertSchema(schemaRegistry, 'contracts/project.schema.json', project);
        sendJson(response, 200, project);
        return;
      }

      if (method === 'POST' && pathname === '/api/v1/workflow-runs') {
        if (!canStartWorkflow(actor)) {
          denyWithAudit(store, schemaRegistry, actor, 'workflow-run.start', 'workflow-run', 'unknown', 'Actor cannot start workflow runs.');
        }

        const body = await readJsonBody(request);

        if (!isRecord(body) || typeof body.projectId !== 'string') {
          throw createHttpError(400, 'projectId is required.');
        }

        const project = store.getProject(body.projectId);

        if (!project) {
          throw createHttpError(404, 'Project not found.');
        }

        assertTenantAccess(actor, getTenantId(project), store, schemaRegistry, 'workflow-run.start', 'project', project.id);

        const projectInput = toWorkflowInput(project.input);
        const workflowInput = toWorkflowInput({
          diseaseName: typeof body.diseaseName === 'string' ? body.diseaseName : projectInput.diseaseName,
          audienceTier: typeof body.audienceTier === 'string' ? body.audienceTier : projectInput.audienceTier,
          lengthProfile: typeof body.lengthProfile === 'string' ? body.lengthProfile : projectInput.lengthProfile,
          qualityProfile: typeof body.qualityProfile === 'string' ? body.qualityProfile : projectInput.qualityProfile,
          styleProfile: typeof body.styleProfile === 'string' ? body.styleProfile : projectInput.styleProfile,
        });
        const workflowInputValidation = validatePayload(schemaRegistry, 'contracts/disease-intake-request.schema.json', workflowInput);

        if (!workflowInputValidation.valid) {
          throw createHttpError(400, 'Workflow input is invalid.', workflowInputValidation.error);
        }

        const timestamp = new Date().toISOString();
        let workflowRun = {
          ...createDraftWorkflowRun(
            workflowSpec,
            project,
            createId('run'),
            timestamp,
            workflowInput,
          ),
          tenantId: getTenantId(project),
        };

        workflowRun = transitionWorkflow(store, schemaRegistry, workflowSpec, workflowRun, {
          eventType: 'START_RUN',
          actor: {
            type: 'user',
            id: actor.id,
          },
          notes: 'Workflow run created from intake request.',
        });

        workflowRun = transitionWorkflow(store, schemaRegistry, workflowSpec, workflowRun, {
          eventType: 'STAGE_PASSED',
          actor: {
            type: 'system',
            id: 'intake-stage',
          },
          payload: {
            storedInput: workflowInput,
          },
          notes: 'Input accepted and stored in workflow context.',
        });

        const canonicalDisease = clinicalService.canonicalizeDiseaseInput(workflowInput.diseaseName);
        workflowRun = persistArtifact(
          store,
          schemaRegistry,
          workflowRun,
          'canonical-disease',
          'contracts/canonical-disease.schema.json',
          canonicalDisease,
        );

        if (canonicalDisease.resolutionStatus !== 'resolved') {
          workflowRun = transitionWorkflow(store, schemaRegistry, workflowSpec, workflowRun, {
            eventType: 'STAGE_FAILED',
            actor: {
              type: 'system',
              id: 'canonicalization-stage',
            },
            payload: {
              canonicalDiseaseId: canonicalDisease.id,
              candidateMatches: canonicalDisease.candidateMatches,
              resolutionStatus: canonicalDisease.resolutionStatus,
            },
            notes: canonicalDisease.notes,
          });
        } else {
          workflowRun = continueResolvedPipeline({
            store,
            schemaRegistry,
            workflowSpec,
            workflowRun,
            workflowInput,
            canonicalDisease,
            clinicalService,
            storyEngineService,
          });
        }

        const nextProject = {
          ...project,
          activeWorkflowRunId: workflowRun.id,
          workflowRunIds: [...project.workflowRunIds, workflowRun.id],
          updatedAt: new Date().toISOString(),
        };

        assertSchema(schemaRegistry, 'contracts/project.schema.json', nextProject);
        store.saveProject(nextProject);
        store.saveWorkflowRun(workflowRun);
        appendAuditLog(
          store,
          schemaRegistry,
          actor,
          'workflow-run.start',
          'workflow-run',
          workflowRun.id,
          'success',
          `Started workflow run for ${workflowInput.diseaseName}.`,
          {
            currentStage: workflowRun.currentStage,
            projectId: project.id,
            state: workflowRun.state,
          },
        );
        sendJson(response, 202, workflowRun);
        return;
      }

      const workflowRunPath = matchWorkflowRunPath(pathname);

      if (method === 'GET' && workflowRunPath) {
        let workflowRun = store.getWorkflowRun(workflowRunPath.runId);

        if (!workflowRun) {
          throw createHttpError(404, 'Workflow run not found.');
        }

        workflowRun = syncLatestEvalMetadata(store, schemaRegistry, workflowRun);
        assertTenantAccess(actor, getTenantId(workflowRun), store, schemaRegistry, 'workflow-run.view', 'workflow-run', workflowRun.id);
        assertSchema(schemaRegistry, 'contracts/workflow-run.schema.json', workflowRun);
        sendJson(response, 200, workflowRun);
        return;
      }

      const workflowRunClinicalPackagePath = matchWorkflowRunClinicalPackagePath(pathname);

      if (method === 'GET' && workflowRunClinicalPackagePath) {
        const workflowRun = store.getWorkflowRun(workflowRunClinicalPackagePath.runId);

        if (!workflowRun) {
          throw createHttpError(404, 'Workflow run not found.');
        }

        assertTenantAccess(actor, getTenantId(workflowRun), store, schemaRegistry, 'clinical-package.view', 'workflow-run', workflowRun.id);
        const clinicalPackage = loadClinicalPackageForRun({
          store,
          workflowRun,
          clinicalService,
        });

        if (!clinicalPackage) {
          throw createHttpError(404, 'Clinical package is not available for this workflow run.');
        }

        sendJson(response, 200, clinicalPackage);
        return;
      }

      const workflowRunClinicalPackageRebuildPath = matchWorkflowRunClinicalPackageRebuildPath(pathname);

      if (method === 'POST' && workflowRunClinicalPackageRebuildPath) {
        const workflowRun = store.getWorkflowRun(workflowRunClinicalPackageRebuildPath.runId);

        if (!workflowRun) {
          throw createHttpError(404, 'Workflow run not found.');
        }

        assertTenantAccess(actor, getTenantId(workflowRun), store, schemaRegistry, 'clinical-package.rebuild', 'workflow-run', workflowRun.id);
        const body = await readJsonBody(request);
        const rebuiltRun = rebuildClinicalPackageForRun({
          store,
          schemaRegistry,
          workflowSpec,
          clinicalService,
          storyEngineService,
          workflowRun,
          actor,
          reason: isRecord(body) && typeof body.reason === 'string' ? body.reason : undefined,
        });
        sendJson(response, 200, rebuiltRun);
        return;
      }

      const workflowEventPath = matchWorkflowRunEventPath(pathname);

      if (method === 'POST' && workflowEventPath) {
        const workflowRun = store.getWorkflowRun(workflowEventPath.runId);

        if (!workflowRun) {
          throw createHttpError(404, 'Workflow run not found.');
        }

        assertTenantAccess(actor, getTenantId(workflowRun), store, schemaRegistry, 'workflow-run.event', 'workflow-run', workflowRun.id);

        if (!canApplyManualWorkflowEvent(actor)) {
          denyWithAudit(store, schemaRegistry, actor, 'workflow-run.event', 'workflow-run', workflowRun.id, 'Actor cannot apply manual workflow events.');
        }

        const body = await readJsonBody(request);

        if (!isRecord(body) || typeof body.eventType !== 'string' || !isRecord(body.actor)) {
          throw createHttpError(400, 'eventType and actor are required.');
        }

        const updatedWorkflowRun = transitionWorkflow(store, schemaRegistry, workflowSpec, workflowRun, {
          eventType: body.eventType,
          actor: {
            type: typeof body.actor.type === 'string' ? body.actor.type : 'system',
            id: actor.id,
          },
          payload: isRecord(body.payload) ? body.payload : {},
          notes: typeof body.notes === 'string' ? body.notes : undefined,
        });

        appendAuditLog(
          store,
          schemaRegistry,
          actor,
          'workflow-run.event',
          'workflow-run',
          updatedWorkflowRun.id,
          'success',
          `Applied ${body.eventType}.`,
          {
            eventType: body.eventType,
          },
        );
        sendJson(response, 200, updatedWorkflowRun);
        return;
      }

      const workflowApprovalPath = matchWorkflowRunApprovalPath(pathname);

      if (method === 'POST' && workflowApprovalPath) {
        const workflowRun = store.getWorkflowRun(workflowApprovalPath.runId);

        if (!workflowRun) {
          throw createHttpError(404, 'Workflow run not found.');
        }

        assertTenantAccess(actor, getTenantId(workflowRun), store, schemaRegistry, 'approval.submit', 'workflow-run', workflowRun.id);

        const body = await readJsonBody(request);

        if (!isRecord(body) || typeof body.role !== 'string' || typeof body.decision !== 'string') {
          throw createHttpError(400, 'role and decision are required.');
        }

        const updatedWorkflowRun = submitApproval({
          store,
          schemaRegistry,
          workflowSpec,
          workflowRun,
          actor,
          role: body.role,
          decision: body.decision,
          comment: typeof body.comment === 'string' ? body.comment : undefined,
        });

        sendJson(response, 200, updatedWorkflowRun);
        return;
      }

      const workflowRunCanonicalizationResolutionPath = matchWorkflowRunCanonicalizationResolutionPath(pathname);

      if (method === 'POST' && workflowRunCanonicalizationResolutionPath) {
        const workflowRun = store.getWorkflowRun(workflowRunCanonicalizationResolutionPath.runId);

        if (!workflowRun) {
          throw createHttpError(404, 'Workflow run not found.');
        }

        assertTenantAccess(actor, getTenantId(workflowRun), store, schemaRegistry, 'canonicalization.resolve', 'workflow-run', workflowRun.id);
        const body = await readJsonBody(request);

        if (!isRecord(body) || typeof body.selectedCanonicalDiseaseName !== 'string' || typeof body.reason !== 'string') {
          throw createHttpError(400, 'selectedCanonicalDiseaseName and reason are required.');
        }

        const updatedWorkflowRun = resolveCanonicalizationForRun({
          store,
          schemaRegistry,
          workflowSpec,
          clinicalService,
          storyEngineService,
          workflowRun,
          actor,
          selectedCanonicalDiseaseName: body.selectedCanonicalDiseaseName,
          reason: body.reason,
        });

        sendJson(response, 200, updatedWorkflowRun);
        return;
      }

      const workflowRunAuditLogPath = matchWorkflowRunAuditLogPath(pathname);

      if (method === 'GET' && workflowRunAuditLogPath) {
        const workflowRun = store.getWorkflowRun(workflowRunAuditLogPath.runId);

        if (!workflowRun) {
          throw createHttpError(404, 'Workflow run not found.');
        }

        assertTenantAccess(actor, getTenantId(workflowRun), store, schemaRegistry, 'audit-log.view', 'workflow-run', workflowRun.id);
        sendJson(response, 200, store.listAuditLogEntries({ subjectId: workflowRun.id, subjectType: 'workflow-run' }));
        return;
      }

      const workflowRunExportPath = matchWorkflowRunExportPath(pathname);

      if (workflowRunExportPath && method === 'GET') {
        const workflowRun = store.getWorkflowRun(workflowRunExportPath.runId);

        if (!workflowRun) {
          throw createHttpError(404, 'Workflow run not found.');
        }

        assertTenantAccess(actor, getTenantId(workflowRun), store, schemaRegistry, 'export-history.view', 'workflow-run', workflowRun.id);
        const exportHistory = store.listExportHistoryEntries(workflowRun.id);
        exportHistory.forEach((entry) => assertSchema(schemaRegistry, 'contracts/export-history-entry.schema.json', entry));
        sendJson(response, 200, exportHistory);
        return;
      }

      if (workflowRunExportPath && method === 'POST') {
        const workflowRun = store.getWorkflowRun(workflowRunExportPath.runId);

        if (!workflowRun) {
          throw createHttpError(404, 'Workflow run not found.');
        }

        assertTenantAccess(actor, getTenantId(workflowRun), store, schemaRegistry, 'workflow-run.export', 'workflow-run', workflowRun.id);
        const project = getProjectForRun(store, workflowRun);
        const exportRequest = await readJsonBody(request);
        const exportedRun = exportWorkflowRun({
          store,
          schemaRegistry,
          workflowSpec,
          exporterService,
          workflowRun,
          project,
          actor,
          exportTargets: isRecord(exportRequest) && Array.isArray(exportRequest.exportTargets)
            ? exportRequest.exportTargets.filter((target) => typeof target === 'string')
            : undefined,
          version: isRecord(exportRequest) && typeof exportRequest.version === 'string'
            ? exportRequest.version
            : undefined,
        });
        sendJson(response, 201, {
          workflowRun: exportedRun.workflowRun,
          releaseBundle: exportedRun.releaseBundle,
          exportHistoryEntry: exportedRun.exportHistoryEntry,
        });
        return;
      }

      const workflowRunEvaluationPath = matchWorkflowRunEvaluationPath(pathname);

      if (workflowRunEvaluationPath && method === 'GET') {
        const workflowRun = store.getWorkflowRun(workflowRunEvaluationPath.runId);

        if (!workflowRun) {
          throw createHttpError(404, 'Workflow run not found.');
        }

        assertTenantAccess(actor, getTenantId(workflowRun), store, schemaRegistry, 'workflow-run.evaluations.view', 'workflow-run', workflowRun.id);
        const evalRuns = listEvaluationReferences(workflowRun)
          .map((artifactReference) => store.getArtifact('eval-run', artifactReference.artifactId))
          .filter(Boolean);
        evalRuns.forEach((evalRun) => assertSchema(schemaRegistry, 'contracts/eval-run.schema.json', evalRun));
        sendJson(response, 200, evalRuns);
        return;
      }

      if (workflowRunEvaluationPath && method === 'POST') {
        const workflowRun = store.getWorkflowRun(workflowRunEvaluationPath.runId);

        if (!workflowRun) {
          throw createHttpError(404, 'Workflow run not found.');
        }

        assertTenantAccess(actor, getTenantId(workflowRun), store, schemaRegistry, 'workflow-run.evaluate', 'workflow-run', workflowRun.id);
        const updatedWorkflowRun = evaluateWorkflowRun({
          store,
          schemaRegistry,
          evalService,
          workflowRun,
          actor,
        });
        sendJson(response, 201, {
          workflowRun: updatedWorkflowRun,
          evaluation: getLatestEvalRun(store, updatedWorkflowRun),
        });
        return;
      }

      const evaluationPath = matchEvaluationPath(pathname);

      if (evaluationPath && method === 'GET') {
        const evalRun = store.getArtifact('eval-run', evaluationPath.evalRunId);

        if (!evalRun) {
          throw createHttpError(404, 'Eval run not found.');
        }

        const workflowRun = store.getWorkflowRun(evalRun.workflowRunId);

        if (!workflowRun) {
          throw createHttpError(404, 'Workflow run not found.');
        }

        assertTenantAccess(actor, getTenantId(workflowRun), store, schemaRegistry, 'workflow-run.evaluate.view', 'workflow-run', workflowRun.id);
        assertSchema(schemaRegistry, 'contracts/eval-run.schema.json', evalRun);
        sendJson(response, 200, evalRun);
        return;
      }

      const artifactPath = matchArtifactPath(pathname);

      if (method === 'GET' && artifactPath) {
        const workflowRun = findWorkflowRunByArtifactReference(store, artifactPath.artifactType, artifactPath.artifactId);

        if (!workflowRun) {
          throw createHttpError(404, 'Artifact not found.');
        }

        assertTenantAccess(actor, getTenantId(workflowRun), store, schemaRegistry, 'artifact.view', 'workflow-run', workflowRun.id);

        const artifact = store.getArtifact(artifactPath.artifactType, artifactPath.artifactId);

        if (!artifact) {
          throw createHttpError(404, 'Artifact not found.');
        }

        sendJson(response, 200, artifact);
        return;
      }

      const evidenceRecordPath = matchEvidenceRecordPath(pathname);

      if (method === 'GET' && evidenceRecordPath) {
        if (!canViewTenantData(actor)) {
          throw createHttpError(403, 'Actor cannot read evidence records.');
        }

        const governanceDecisions = listTenantGovernanceArtifacts(store, actor.tenantId, 'source-governance-decision');
        const contradictionResolutions = listTenantGovernanceArtifacts(store, actor.tenantId, 'contradiction-resolution');
        const evidenceRecord = clinicalService.getEvidenceRecord(evidenceRecordPath.claimId, {
          governanceDecisions,
          contradictionResolutions,
        });

        if (!evidenceRecord) {
          throw createHttpError(404, 'Evidence record not found.');
        }

        assertSchema(schemaRegistry, 'contracts/evidence-record.schema.json', evidenceRecord);
        sendJson(response, 200, evidenceRecord);
        return;
      }

      const contradictionResolutionPath = matchContradictionResolutionPath(pathname);

      if (method === 'POST' && contradictionResolutionPath) {
        if (!canViewTenantData(actor)) {
          throw createHttpError(403, 'Actor cannot record contradiction resolutions.');
        }

        const body = await readJsonBody(request);

        if (!isRecord(body) || typeof body.canonicalDiseaseName !== 'string' || typeof body.status !== 'string') {
          throw createHttpError(400, 'canonicalDiseaseName and status are required.');
        }

        const matchingRun = store.listWorkflowRuns().find((workflowRun) => (
          getTenantId(workflowRun) === actor.tenantId
          && loadResolvedCanonicalDiseaseForRun(store, workflowRun)?.canonicalDiseaseName === body.canonicalDiseaseName
        ));

        if (!matchingRun) {
          throw createHttpError(404, 'No workflow run was found for the requested canonical disease.');
        }

        const evidenceRecord = clinicalService.getEvidenceRecord(contradictionResolutionPath.claimId, {
          governanceDecisions: listTenantGovernanceArtifacts(store, actor.tenantId, 'source-governance-decision'),
          contradictionResolutions: listTenantGovernanceArtifacts(store, actor.tenantId, 'contradiction-resolution'),
        });

        if (!evidenceRecord || evidenceRecord.canonicalDiseaseName !== body.canonicalDiseaseName) {
          throw createHttpError(404, 'Evidence record not found for the requested disease.');
        }

        const contradictionResolution = saveContradictionResolution({
          store,
          schemaRegistry,
          workflowRun: matchingRun,
          actor,
          canonicalDiseaseName: body.canonicalDiseaseName,
          claimId: contradictionResolutionPath.claimId,
          relatedClaimId: typeof body.relatedClaimId === 'string' ? body.relatedClaimId : undefined,
          status: body.status,
          reason: typeof body.reason === 'string' ? body.reason : undefined,
        });

        sendJson(response, 201, contradictionResolution);
        return;
      }

      if (method === 'GET' && pathname === '/api/v1/source-records') {
        if (!canViewTenantData(actor)) {
          throw createHttpError(403, 'Actor cannot read source governance records.');
        }

        const diseaseName = requestUrl.searchParams.get('canonicalDiseaseName');

        if (!diseaseName) {
          throw createHttpError(400, 'canonicalDiseaseName is required to list source records.');
        }

        const governanceDecisions = listTenantGovernanceArtifacts(store, actor.tenantId, 'source-governance-decision');
        const contradictionResolutions = listTenantGovernanceArtifacts(store, actor.tenantId, 'contradiction-resolution');
        const sourceRecords = clinicalService.listSourceRecords(diseaseName, {
          governanceDecisions,
          contradictionResolutions,
        });
        sourceRecords.forEach((sourceRecord) => assertSchema(schemaRegistry, 'contracts/source-record.schema.json', sourceRecord));
        sendJson(response, 200, sourceRecords);
        return;
      }

      const sourceRecordPath = matchSourceRecordPath(pathname);

      if (method === 'GET' && sourceRecordPath) {
        if (!canViewTenantData(actor)) {
          throw createHttpError(403, 'Actor cannot read source governance records.');
        }

        const governanceDecisions = listTenantGovernanceArtifacts(store, actor.tenantId, 'source-governance-decision');
        const contradictionResolutions = listTenantGovernanceArtifacts(store, actor.tenantId, 'contradiction-resolution');
        const sourceRecord = clinicalService.getSourceRecord(sourceRecordPath.sourceId, {
          governanceDecisions,
          contradictionResolutions,
        });

        if (!sourceRecord) {
          throw createHttpError(404, 'Source record not found.');
        }

        assertSchema(schemaRegistry, 'contracts/source-record.schema.json', sourceRecord);
        sendJson(response, 200, sourceRecord);
        return;
      }

      const sourceGovernanceDecisionPath = matchSourceGovernanceDecisionPath(pathname);

      if (method === 'POST' && sourceGovernanceDecisionPath) {
        if (!canViewTenantData(actor)) {
          throw createHttpError(403, 'Actor cannot record source governance decisions.');
        }

        const body = await readJsonBody(request);

        if (!isRecord(body) || typeof body.canonicalDiseaseName !== 'string' || typeof body.decision !== 'string') {
          throw createHttpError(400, 'canonicalDiseaseName and decision are required.');
        }

        const matchingRun = store.listWorkflowRuns().find((workflowRun) => (
          getTenantId(workflowRun) === actor.tenantId
          && loadResolvedCanonicalDiseaseForRun(store, workflowRun)?.canonicalDiseaseName === body.canonicalDiseaseName
        ));

        if (!matchingRun) {
          throw createHttpError(404, 'No workflow run was found for the requested canonical disease.');
        }

        const sourceRecord = clinicalService.getSourceRecord(sourceGovernanceDecisionPath.sourceId, {
          governanceDecisions: listTenantGovernanceArtifacts(store, actor.tenantId, 'source-governance-decision'),
          contradictionResolutions: listTenantGovernanceArtifacts(store, actor.tenantId, 'contradiction-resolution'),
        });

        if (!sourceRecord) {
          throw createHttpError(404, 'Source record not found.');
        }

        const governanceDecision = saveSourceGovernanceDecision({
          store,
          schemaRegistry,
          workflowRun: matchingRun,
          actor,
          canonicalDiseaseName: body.canonicalDiseaseName,
          sourceId: sourceGovernanceDecisionPath.sourceId,
          decision: body.decision,
          reason: typeof body.reason === 'string' ? body.reason : undefined,
          notes: Array.isArray(body.notes) ? body.notes.filter((value) => typeof value === 'string') : [],
        });

        sendJson(response, 201, governanceDecision);
        return;
      }

      const releaseBundlePath = matchReleaseBundlePath(pathname);

      if (method === 'GET' && releaseBundlePath) {
        const releaseBundle = store.getArtifact('release-bundle', releaseBundlePath.releaseId);

        if (!releaseBundle) {
          throw createHttpError(404, 'Release bundle not found.');
        }

        assertTenantAccess(actor, releaseBundle.tenantId, store, schemaRegistry, 'release-bundle.view', 'workflow-run', releaseBundle.workflowRunId);
        assertSchema(schemaRegistry, 'contracts/release-bundle.schema.json', releaseBundle);
        sendJson(response, 200, releaseBundle);
        return;
      }

      const releaseBundleIndexPath = matchReleaseBundleIndexPath(pathname);

      if (method === 'GET' && releaseBundleIndexPath) {
        const releaseBundle = store.getArtifact('release-bundle', releaseBundleIndexPath.releaseId);

        if (!releaseBundle) {
          throw createHttpError(404, 'Release bundle not found.');
        }

        assertTenantAccess(actor, releaseBundle.tenantId, store, schemaRegistry, 'release-bundle.index.view', 'workflow-run', releaseBundle.workflowRunId);
        const bundleIndex = store.getDocument('release-index', releaseBundleIndexPath.releaseId);

        if (!bundleIndex) {
          throw createHttpError(404, 'Release bundle index not found.');
        }

        response.statusCode = 200;
        response.setHeader('content-type', 'text/markdown; charset=utf-8');
        response.end(bundleIndex);
        return;
      }

      const releaseEvidencePackPath = matchReleaseEvidencePackPath(pathname);

      if (method === 'GET' && releaseEvidencePackPath) {
        const releaseBundle = store.getArtifact('release-bundle', releaseEvidencePackPath.releaseId);

        if (!releaseBundle) {
          throw createHttpError(404, 'Release bundle not found.');
        }

        assertTenantAccess(actor, releaseBundle.tenantId, store, schemaRegistry, 'release-bundle.evidence-pack.view', 'workflow-run', releaseBundle.workflowRunId);
        const evidencePack = store.getDocument('source-evidence-pack', releaseEvidencePackPath.releaseId);

        if (!evidencePack) {
          throw createHttpError(404, 'Release evidence pack not found.');
        }

        sendJson(response, 200, JSON.parse(evidencePack));
        return;
      }

      throw createHttpError(404, 'Route not found.');
    } catch (error) {
      if (error && typeof error === 'object' && 'statusCode' in error && typeof error.statusCode === 'number') {
        sendError(
          response,
          error.statusCode,
          error instanceof Error ? error.message : 'Request failed.',
          // @ts-ignore - structured details are optional on route errors.
          error.details,
        );
        return;
      }

      sendError(response, 500, 'Internal server error.', error instanceof Error ? error.message : String(error));
    }
  });

  return {
    server,
    store,
  };
}
