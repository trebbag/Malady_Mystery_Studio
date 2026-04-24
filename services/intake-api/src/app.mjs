import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
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
import {
  createLocalRuntimeView,
  createRenderingGuideView,
  createReviewDashboardView,
  createReviewRunView,
  createWorkflowArtifactListView,
} from '../../../apps/web/src/view-model-adapters.mjs';
import { createClinicalRetrievalService } from '../../clinical-retrieval/src/service.mjs';
import { createResearchAssemblyService } from '../../clinical-retrieval/src/research-assembly.mjs';
import { normalizeDiseaseInput } from '../../clinical-retrieval/src/ontology-adapter.mjs';
import {
  buildRenderingGuide,
  normalizeRenderingGuide,
  renderRenderingGuideMarkdown,
} from '../../exporter/src/rendering-guide.mjs';
import {
  applyVisualReferencePackToRenderingGuide,
  buildVisualReferencePack,
} from '../../exporter/src/visual-reference-pack.mjs';
import { createExporterService } from '../../exporter/src/service.mjs';
import {
  applyWorkflowEvent,
  areRequiredApprovalsApproved,
  createDraftWorkflowRun,
  loadWorkflowSpec,
} from '../../orchestrator/src/workflow-machine.mjs';
import { createRenderExecutionService } from '../../render-execution/src/service.mjs';
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
import {
  countOpenReviewComments,
  diffJsonValues,
  isActiveReviewAssignment,
  listReviewAssignmentsForRun,
  listReviewCommentsForRun,
  matchesAssignmentFilter,
  summarizeAssignmentDisplayNames,
  summarizeJsonDiff,
} from './review-service.mjs';
import {
  buildReviewMessage,
  buildReviewQueueAnalyticsView,
  buildReviewQueueAnalyticsSnapshot,
  buildReviewQueueView,
  buildReviewThread,
  buildWorkItem,
  escalateOverdueWorkItems,
  isWorkItemOverdue,
  listMessagesForThread,
  listReviewThreadsForRun,
  listWorkItemsForRun,
} from './work-item-service.mjs';
import { createPlatformRuntime } from './platform-runtime.mjs';
import { createMetadataStore } from './metadata-store.mjs';
import { PlatformStore } from './store.mjs';

const SCHEMA_VERSION = '1.0.0';
const WEB_ROUTE_ARTIFACT_GROUPS = Object.freeze({
  workbooks: ['story-workbook', 'narrative-review-trace', 'qa-report'],
  scenes: ['scene-card'],
  panels: ['panel-plan', 'render-prompt', 'render-job', 'render-attempt', 'rendered-asset', 'rendered-asset-manifest', 'rendering-guide', 'visual-reference-pack', 'render-guide-review-decision', 'lettering-map', 'qa-report'],
});
const MANUAL_RENDER_TARGET_PROFILE_ID = 'rtp.external-manual';
const FRONTEND_READINESS_SNAPSHOT = Object.freeze({
  areas: [
    {
      label: 'Foundation and local runtime',
      percentComplete: 100,
    },
    {
      label: 'Local storage, backup, restore, and artifact retention',
      percentComplete: 100,
    },
    {
      label: 'Open disease intake and research assembly',
      percentComplete: 94,
    },
    {
      label: 'Clinical truth layer and governance',
      percentComplete: 98,
    },
    {
      label: 'Workbook and guardrails',
      percentComplete: 80,
    },
    {
      label: 'Scene, panel, and rendered-output flow',
      percentComplete: 98,
    },
    {
      label: 'Review, eval, export, and queue operations',
      percentComplete: 100,
    },
    {
      label: 'Frontend UX',
      percentComplete: 99,
    },
    {
      label: 'Local operations proof',
      percentComplete: 98,
    },
  ],
  overall: {
    localMvpReadiness: 100,
    pilotReadiness: 92,
  },
  remainingWork: [
    'Run sustained full-story ChatGPT Image 2.0 / gpt-image-2 panel completion after billing limits are cleared; stub assets validate structure only.',
    'Repeat pilot rehearsal with realistic run volume to prove queue trends, restore-smoke, local mirror verification, and rendered-panel QA under load.',
    'Continue broadening governed source ownership workflows as reviewer volume and disease coverage grow.',
    'Add downstream delivery integrations only after local mirrored bundles remain stable in repeated rehearsals.',
  ],
});
const CONTENT_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);
const REVIEW_COMMENT_STATUSES = new Set(['open', 'resolved', 'note']);
const REVIEW_COMMENT_SEVERITIES = new Set(['info', 'warning', 'critical']);
const REVIEW_ASSIGNMENT_STATUSES = new Set(['queued', 'in-progress', 'completed', 'reassigned']);
const WORK_ITEM_STATUSES = new Set(['queued', 'in-progress', 'completed', 'escalated', 'cancelled']);
const THREAD_STATUSES = new Set(['open', 'resolved', 'archived']);

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
 * @returns {{ runId: string } | null}
 */
function matchWorkflowRunReviewViewPath(pathname) {
  const match = pathname.match(/^\/api\/v1\/workflow-runs\/([^/]+)\/review-run-view$/);
  return match ? { runId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ runId: string } | null}
 */
function matchWorkflowRunRenderingGuidePath(pathname) {
  const match = pathname.match(/^\/api\/v1\/workflow-runs\/([^/]+)\/rendering-guide$/);
  return match ? { runId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ runId: string } | null}
 */
function matchWorkflowRunRenderingGuideRegeneratePath(pathname) {
  const match = pathname.match(/^\/api\/v1\/workflow-runs\/([^/]+)\/rendering-guide\/regenerate$/);
  return match ? { runId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ runId: string } | null}
 */
function matchWorkflowRunRenderingGuideReviewPath(pathname) {
  const match = pathname.match(/^\/api\/v1\/workflow-runs\/([^/]+)\/rendering-guide-review$/);
  return match ? { runId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ runId: string } | null}
 */
function matchWorkflowRunRenderingGuideReviewDecisionPath(pathname) {
  const match = pathname.match(/^\/api\/v1\/workflow-runs\/([^/]+)\/rendering-guide\/review-decisions$/);
  return match ? { runId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ runId: string } | null}
 */
function matchWorkflowRunVisualReferencePackRegeneratePath(pathname) {
  const match = pathname.match(/^\/api\/v1\/workflow-runs\/([^/]+)\/visual-reference-pack\/regenerate$/);
  return match ? { runId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ runId: string } | null}
 */
function matchWorkflowRunResearchBriefPath(pathname) {
  const match = pathname.match(/^\/api\/v1\/workflow-runs\/([^/]+)\/research-brief$/);
  return match ? { runId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ runId: string } | null}
 */
function matchWorkflowRunKnowledgePackBuildReportPath(pathname) {
  const match = pathname.match(/^\/api\/v1\/workflow-runs\/([^/]+)\/knowledge-pack-build-report$/);
  return match ? { runId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ runId: string } | null}
 */
function matchWorkflowRunKnowledgePackRegeneratePath(pathname) {
  const match = pathname.match(/^\/api\/v1\/workflow-runs\/([^/]+)\/knowledge-pack\/regenerate$/);
  return match ? { runId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ runId: string } | null}
 */
function matchWorkflowRunKnowledgePackApprovePath(pathname) {
  const match = pathname.match(/^\/api\/v1\/workflow-runs\/([^/]+)\/knowledge-pack\/approve$/);
  return match ? { runId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ runId: string } | null}
 */
function matchWorkflowRunKnowledgePackPromotePath(pathname) {
  const match = pathname.match(/^\/api\/v1\/workflow-runs\/([^/]+)\/knowledge-pack\/promote$/);
  return match ? { runId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ runId: string } | null}
 */
function matchWorkflowRunArtifactsPath(pathname) {
  const match = pathname.match(/^\/api\/v1\/workflow-runs\/([^/]+)\/artifacts$/);
  return match ? { runId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ runId: string } | null}
 */
function matchWorkflowRunCommentsPath(pathname) {
  const match = pathname.match(/^\/api\/v1\/workflow-runs\/([^/]+)\/comments$/);
  return match ? { runId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ runId: string } | null}
 */
function matchWorkflowRunAssignmentsPath(pathname) {
  const match = pathname.match(/^\/api\/v1\/workflow-runs\/([^/]+)\/assignments$/);
  return match ? { runId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ runId: string } | null}
 */
function matchWorkflowRunArtifactDiffPath(pathname) {
  const match = pathname.match(/^\/api\/v1\/workflow-runs\/([^/]+)\/artifact-diffs$/);
  return match ? { runId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ runId: string } | null}
 */
function matchWorkflowRunThreadsPath(pathname) {
  const match = pathname.match(/^\/api\/v1\/workflow-runs\/([^/]+)\/threads$/);
  return match ? { runId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ runId: string } | null}
 */
function matchWorkflowRunRenderJobsPath(pathname) {
  const match = pathname.match(/^\/api\/v1\/workflow-runs\/([^/]+)\/render-jobs$/);
  return match ? { runId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ runId: string } | null}
 */
function matchWorkflowRunRenderedAssetAttachmentPath(pathname) {
  const match = pathname.match(/^\/api\/v1\/workflow-runs\/([^/]+)\/rendered-assets\/attach$/);
  return match ? { runId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ threadId: string } | null}
 */
function matchReviewThreadMessagesPath(pathname) {
  const match = pathname.match(/^\/api\/v1\/review-threads\/([^/]+)\/messages$/);
  return match ? { threadId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ workItemId: string } | null}
 */
function matchWorkItemPath(pathname) {
  const match = pathname.match(/^\/api\/v1\/work-items\/([^/]+)$/);
  return match ? { workItemId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ jobId: string } | null}
 */
function matchRenderJobPath(pathname) {
  const match = pathname.match(/^\/api\/v1\/render-jobs\/([^/]+)$/);
  return match ? { jobId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ jobId: string } | null}
 */
function matchRenderJobRetryPath(pathname) {
  const match = pathname.match(/^\/api\/v1\/render-jobs\/([^/]+)\/retry$/);
  return match ? { jobId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ sourceId: string } | null}
 */
function matchSourceRefreshTaskPath(pathname) {
  const match = pathname.match(/^\/api\/v1\/source-catalog\/([^/]+)\/refresh-tasks$/);
  return match ? { sourceId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ sourceId: string } | null}
 */
function matchSourceOwnershipPath(pathname) {
  const match = pathname.match(/^\/api\/v1\/source-catalog\/([^/]+)\/ownership$/);
  return match ? { sourceId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {boolean}
 */
function isReviewDashboardViewPath(pathname) {
  return pathname === '/api/v1/review-dashboard-view';
}

/**
 * @param {string} pathname
 * @returns {boolean}
 */
function isReviewQueueViewPath(pathname) {
  return pathname === '/api/v1/review-queue';
}

/**
 * @param {string} pathname
 * @returns {boolean}
 */
function isReviewQueueAnalyticsPath(pathname) {
  return pathname === '/api/v1/review-queue/analytics';
}

/**
 * @param {string} pathname
 * @returns {boolean}
 */
function isReviewQueueAnalyticsHistoryPath(pathname) {
  return pathname === '/api/v1/review-queue/analytics/history';
}

/**
 * @param {string} pathname
 * @returns {boolean}
 */
function isReviewQueueAnalyticsSnapshotPath(pathname) {
  return pathname === '/api/v1/review-queue/analytics/snapshots';
}

/**
 * @param {string} pathname
 * @returns {boolean}
 */
function isReviewQueueProofScenarioPath(pathname) {
  return pathname === '/api/v1/review-queue/proof-scenario';
}

/**
 * @param {string} pathname
 * @returns {boolean}
 */
function isLocalRuntimeViewPath(pathname) {
  return pathname === '/api/v1/local-runtime-view';
}

/**
 * @param {string} pathname
 * @returns {boolean}
 */
function isLocalOpsStatusPath(pathname) {
  return pathname === '/api/v1/local-ops/status';
}

/**
 * @param {string} pathname
 * @returns {boolean}
 */
function isLocalOpsRestoreSmokePath(pathname) {
  return pathname === '/api/v1/local-ops/restore-smoke';
}

/**
 * @param {string} pathname
 * @returns {boolean}
 */
function isSourceCatalogPath(pathname) {
  return pathname === '/api/v1/source-catalog';
}

/**
 * @param {string} pathname
 * @returns {boolean}
 */
function isSourceOpsPath(pathname) {
  return pathname === '/api/v1/source-ops';
}

/**
 * @param {string} pathname
 * @returns {boolean}
 */
function isSourceOpsCalendarPath(pathname) {
  return pathname === '/api/v1/source-ops/calendar';
}

/**
 * @param {string} pathname
 * @returns {boolean}
 */
function isNotificationsPath(pathname) {
  return pathname === '/api/v1/notifications';
}

/**
 * @param {string} pathname
 * @returns {{ notificationId: string } | null}
 */
function matchNotificationPath(pathname) {
  const match = pathname.match(/^\/api\/v1\/notifications\/([^/]+)$/);
  return match ? { notificationId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ runId: string } | null}
 */
function matchDebugReviewRunPath(pathname) {
  const match = pathname.match(/^\/debug\/review\/runs\/([^/]+)$/);
  return match ? { runId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ runId: string } | null}
 */
function matchLegacyClinicalPackageReviewPath(pathname) {
  const match = pathname.match(/^\/review\/runs\/([^/]+)\/clinical-package$/);
  return match ? { runId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ runId: string } | null}
 */
function matchLegacyEvaluationReviewPath(pathname) {
  const match = pathname.match(/^\/review\/runs\/([^/]+)\/evaluations$/);
  return match ? { runId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ runId: string } | null}
 */
function matchLegacyExportReviewPath(pathname) {
  const match = pathname.match(/^\/review\/runs\/([^/]+)\/exports$/);
  return match ? { runId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {boolean}
 */
function isSpaShellPath(pathname) {
  return pathname === '/review'
    || pathname === '/review/queue'
    || pathname === '/settings'
    || /^\/runs\/[^/]+\/(pipeline|review|packets|evidence|workbooks|scenes|panels|sources|governance|evals|bundles|rendering-guide)$/.test(pathname);
}

/**
 * @param {string} pathname
 * @returns {boolean}
 */
function isWebAssetPath(pathname) {
  return pathname.startsWith('/assets/')
    || pathname === '/favicon.svg'
    || pathname === '/vite.svg';
}

/**
 * @param {string} filePath
 * @returns {string}
 */
function getContentTypeForFile(filePath) {
  return CONTENT_TYPES.get(path.extname(filePath).toLowerCase()) ?? 'application/octet-stream';
}

/**
 * @param {string} pathname
 * @returns {string[]}
 */
function normalizeArtifactTypeFilters(pathname) {
  return pathname
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

/**
 * @param {URLSearchParams} searchParams
 * @returns {string[]}
 */
function parseArtifactTypeFilters(searchParams) {
  return [...new Set(
    searchParams
      .getAll('artifactType')
      .flatMap((value) => normalizeArtifactTypeFilters(value)),
  )];
}

/**
 * @param {import('node:http').IncomingMessage} request
 * @returns {string}
 */
function getServerBaseUrl(request) {
  const host = request.headers.host ?? '127.0.0.1:3000';
  const protocol = request.headers['x-forwarded-proto'] ?? 'http';
  return `${protocol}://${host}`;
}

/**
 * @returns {any}
 */
function getReadinessSnapshot() {
  return clone(FRONTEND_READINESS_SNAPSHOT);
}

/**
 * @param {{ dbFilePath: string, objectStoreDir: string }} storage
 * @returns {any}
 */
function getLocalStoragePolicy(storage) {
  return {
    mode: 'local-only',
    filesStayLocal: true,
    filesPersistedInPostgres: false,
    metadataStore: 'sqlite',
    objectStore: 'filesystem',
    dbFilePath: storage.dbFilePath,
    objectStoreDir: storage.objectStoreDir,
    postgresUsage: 'disabled-for-active-runtime',
    managedObjectStorageUsage: 'disabled-for-active-runtime',
    backupCommand: 'pnpm local:backup',
    restoreCommand: 'pnpm local:restore -- --path var/backups/<timestamp>',
    resetCommand: 'pnpm local:reset',
    notes: [
      'SQLite stores local metadata only.',
      'Generated artifacts, rendered panels, release bundles, evidence packs, and attachments stay in the filesystem object store.',
      'Postgres is not required for the active local app path and must not store binary files or large artifact payloads.',
    ],
  };
}

/**
 * @param {string} value
 * @returns {string}
 */
function safePathSegment(value) {
  return value.replace(/[^A-Za-z0-9._-]+/g, '-');
}

/**
 * @param {string} value
 * @returns {string}
 */
function timestampPathSegment(value) {
  return safePathSegment(value.replace(/[:.]/g, '-'));
}

/**
 * @param {string} rootDir
 * @returns {{ scenarios: any[] }}
 */
function loadPilotProofScenarioManifest(rootDir) {
  return JSON.parse(readFileSync(path.join(rootDir, 'data', 'pilot-proof-scenarios.json'), 'utf8'));
}

/**
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
async function pathExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} directoryPath
 * @returns {Promise<{ objectCount: number, byteLength: number }>}
 */
async function collectDirectoryStats(directoryPath) {
  if (!(await pathExists(directoryPath))) {
    return {
      objectCount: 0,
      byteLength: 0,
    };
  }

  let objectCount = 0;
  let byteLength = 0;
  const entries = await readdir(directoryPath, {
    withFileTypes: true,
  });

  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      const childStats = await collectDirectoryStats(entryPath);
      objectCount += childStats.objectCount;
      byteLength += childStats.byteLength;
      continue;
    }

    if (entry.isFile()) {
      const fileStats = await stat(entryPath);
      objectCount += 1;
      byteLength += fileStats.size;
    }
  }

  return {
    objectCount,
    byteLength,
  };
}

/**
 * @param {string} rootDir
 * @param {PlatformStore} store
 * @param {string} leafName
 * @param {string} envName
 * @returns {string}
 */
function resolveLocalOpsDirectory(rootDir, store, leafName, envName) {
  const explicitPath = readNonEmptyEnv(process.env[envName]);

  if (explicitPath) {
    return path.isAbsolute(explicitPath) ? explicitPath : path.join(rootDir, explicitPath);
  }

  if (store.dbFilePath.startsWith(path.join(rootDir, 'var'))) {
    return path.join(rootDir, 'var', leafName);
  }

  return path.join(path.dirname(store.dbFilePath), leafName);
}

/**
 * @param {string} directoryPath
 * @returns {Promise<{ path: string, createdAt: string } | null>}
 */
async function getLatestDirectoryEntry(directoryPath) {
  if (!(await pathExists(directoryPath))) {
    return null;
  }

  const entries = await readdir(directoryPath, {
    withFileTypes: true,
  });
  const directories = await Promise.all(entries
    .filter((entry) => entry.isDirectory())
    .map(async (entry) => {
      const entryPath = path.join(directoryPath, entry.name);
      const entryStats = await stat(entryPath);

      return {
        path: entryPath,
        createdAt: entryStats.mtime.toISOString(),
        mtimeMs: entryStats.mtimeMs,
      };
    }));
  directories.sort((left, right) => right.mtimeMs - left.mtimeMs);
  const latest = directories.at(0);

  return latest ? {
    path: latest.path,
    createdAt: latest.createdAt,
  } : null;
}

/**
 * @param {PlatformStore} store
 * @param {string} tenantId
 * @param {string} artifactType
 * @returns {any | null}
 */
function getLatestTenantArtifact(store, tenantId, artifactType) {
  return store.listArtifactsByType(artifactType, { tenantId }).at(0) ?? null;
}

/**
 * @param {string} contents
 * @returns {string}
 */
function sha256Hex(contents) {
  return createHash('sha256').update(contents).digest('hex');
}

/**
 * @param {Buffer} contents
 * @returns {string}
 */
function sha256Buffer(contents) {
  return createHash('sha256').update(contents).digest('hex');
}

/**
 * @param {string} sourcePath
 * @param {string} targetPath
 * @returns {Promise<{ checksum: string, byteLength: number }>}
 */
async function copyFileWithChecksum(sourcePath, targetPath) {
  const contents = await readFile(sourcePath);
  await mkdir(path.dirname(targetPath), {
    recursive: true,
  });
  await writeFile(targetPath, contents);

  return {
    checksum: createHash('sha256').update(contents).digest('hex'),
    byteLength: contents.byteLength,
  };
}

/**
 * @param {string | undefined} value
 * @returns {string | undefined}
 */
function readNonEmptyEnv(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/**
 * @param {string | undefined} value
 * @param {number} fallback
 * @returns {number}
 */
function parsePositiveIntegerEnv(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * @param {string | undefined} value
 * @param {number} fallback
 * @returns {number}
 */
function parseNonNegativeIntegerEnv(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

/**
 * @param {string} rootDir
 * @param {any} renderExecutionService
 * @returns {any}
 */
function getExternalElementsSnapshot(rootDir, renderExecutionService) {
  const canonRoot = readNonEmptyEnv(process.env.MMS_CANON_ROOT) ?? path.join(rootDir, 'data', 'canon');
  const canonAutoDiscoveryEnabled = !['1', 'true', 'yes'].includes(String(process.env.MMS_DISABLE_CANON_AUTO_DISCOVERY ?? '0').toLowerCase());

  return {
    clinicalEducationCompatibility: {
      enabled: true,
      sourceProjectLabel: 'ClinicalEducation / Malady Mystery Studio legacy app',
    },
    openAi: {
      apiKeyConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
      knowledgeBaseVectorStoreConfigured: Boolean(process.env.KB_VECTOR_STORE_ID?.trim()),
      researchModel: readNonEmptyEnv(process.env.OPENAI_RESEARCH_MODEL) ?? readNonEmptyEnv(process.env.MMS_MODEL) ?? 'gpt-5.2',
      renderModel: readNonEmptyEnv(process.env.OPENAI_RENDER_MODEL) ?? 'gpt-image-2',
      renderProvider: readNonEmptyEnv(process.env.RENDER_PROVIDER) ?? renderExecutionService.providerName,
    },
    canon: {
      autoDiscoveryEnabled: canonAutoDiscoveryEnabled,
      root: canonRoot,
      characterBiblePath: readNonEmptyEnv(process.env.MMS_CHARACTER_BIBLE_PATH) ?? path.join(canonRoot, 'character_bible.md'),
      seriesStyleBiblePath: readNonEmptyEnv(process.env.MMS_SERIES_STYLE_BIBLE_PATH) ?? path.join(canonRoot, 'series_style_bible.md'),
      deckSpecPath: readNonEmptyEnv(process.env.MMS_DECK_SPEC_PATH) ?? path.join(canonRoot, 'episode', 'deck_spec.md'),
      episodeMemoryPath: readNonEmptyEnv(process.env.MMS_EPISODE_MEMORY_PATH) ?? path.join(canonRoot, 'episode', 'episode_memory.json'),
    },
    pipeline: {
      mode: readNonEmptyEnv(process.env.MMS_PIPELINE_MODE) ?? 'real',
      maxConcurrentRuns: parsePositiveIntegerEnv(process.env.MAX_CONCURRENT_RUNS, 1),
      retentionKeepLast: parsePositiveIntegerEnv(process.env.MMS_RUN_RETENTION_KEEP_LAST, 50),
      fakeStepDelayMs: parseNonNegativeIntegerEnv(process.env.MMS_FAKE_STEP_DELAY_MS, 80),
      kb0TimeoutMs: parsePositiveIntegerEnv(process.env.MMS_V2_KB0_TIMEOUT_MS, 120000),
      stepAbAgentTimeoutMs: parsePositiveIntegerEnv(process.env.MMS_V2_STEP_AB_AGENT_TIMEOUT_MS, 120000),
      stepCAgentTimeoutMs: parsePositiveIntegerEnv(process.env.MMS_V2_STEP_C_AGENT_TIMEOUT_MS, 180000),
      stepCDeckSpecTimeoutMs: parsePositiveIntegerEnv(process.env.MMS_V2_STEP_C_DECKSPEC_TIMEOUT_MS, 300000),
      agentIsolationMode: readNonEmptyEnv(process.env.MMS_V2_AGENT_ISOLATION_MODE) ?? '',
    },
  };
}

/**
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
async function fileExists(filePath) {
  try {
    const entry = await stat(filePath);
    return entry.isFile();
  } catch {
    return false;
  }
}

/**
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
async function directoryExists(filePath) {
  try {
    const entry = await stat(filePath);
    return entry.isDirectory();
  } catch {
    return false;
  }
}

/**
 * @param {import('node:http').ServerResponse} response
 * @param {string} filePath
 * @returns {Promise<void>}
 */
async function sendStaticFile(response, filePath) {
  const contents = await readFile(filePath);
  response.statusCode = 200;
  response.setHeader('content-type', getContentTypeForFile(filePath));
  response.end(contents);
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
 * @returns {{ releaseId: string } | null}
 */
function matchReleaseBundleRenderingGuidePath(pathname) {
  const match = pathname.match(/^\/api\/v1\/release-bundles\/([^/]+)\/rendering-guide$/);
  return match ? { releaseId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ releaseId: string } | null}
 */
function matchReleaseBundleMirrorLocalPath(pathname) {
  const match = pathname.match(/^\/api\/v1\/release-bundles\/([^/]+)\/mirror-local$/);
  return match ? { releaseId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ releaseId: string } | null}
 */
function matchReleaseBundleVerifyLocalMirrorPath(pathname) {
  const match = pathname.match(/^\/api\/v1\/release-bundles\/([^/]+)\/verify-local-mirror$/);
  return match ? { releaseId: decodeURIComponent(match[1]) } : null;
}

/**
 * @param {string} pathname
 * @returns {{ manifestId: string } | null}
 */
function matchRenderedAssetManifestQaDecisionPath(pathname) {
  const match = pathname.match(/^\/api\/v1\/rendered-asset-manifests\/([^/]+)\/qa-decisions$/);
  return match ? { manifestId: decodeURIComponent(match[1]) } : null;
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
 * @param {any} workflowRun
 * @param {string} stageName
 * @param {'pending' | 'running' | 'passed' | 'failed' | 'blocked'} status
 * @param {string} [notes]
 * @returns {any}
 */
function markWorkflowStage(workflowRun, stageName, status, notes = undefined) {
  const timestamp = new Date().toISOString();

  return {
    ...workflowRun,
    currentStage: stageName,
    updatedAt: timestamp,
    stages: workflowRun.stages.map((/** @type {any} */ stage) => stage.name === stageName ? {
      ...stage,
      status,
      ...(status === 'running' ? { startedAt: stage.startedAt ?? timestamp } : {}),
      ...(status === 'passed' || status === 'failed' || status === 'blocked' ? { endedAt: timestamp } : {}),
      ...(notes ? { notes } : stage.notes ? { notes: stage.notes } : {}),
    } : stage),
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

  const artifact = store.getArtifact(artifactReference.artifactType, artifactReference.artifactId);

  if (artifactReference.artifactType === 'rendering-guide' && artifact) {
    return normalizeRenderingGuide(artifact);
  }

  return artifact;
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
 * @param {PlatformStore} store
 * @param {any} workflowRun
 * @returns {any | null}
 */
function loadLatestKnowledgePackForRun(store, workflowRun) {
  return loadLatestArtifact(store, workflowRun, 'disease-knowledge-pack');
}

/**
 * @param {PlatformStore} store
 * @param {string} tenantId
 * @returns {any[]}
 */
function listPromotedKnowledgePacks(store, tenantId) {
  return listTenantArtifactsByType(store, 'disease-knowledge-pack', tenantId)
    .filter((knowledgePack) => knowledgePack.packStatus === 'promoted' && knowledgePack.packScope === 'library');
}

/**
 * @param {any} knowledgePack
 * @returns {string[]}
 */
function collectKnowledgePackLookupTerms(knowledgePack) {
  return uniqueStrings([
    knowledgePack.canonicalDiseaseName,
    ...(knowledgePack.aliases ?? []),
  ]).map((value) => normalizeDiseaseInput(value));
}

/**
 * @param {PlatformStore} store
 * @param {string} tenantId
 * @param {string} diseaseInput
 * @returns {any | null}
 */
function findPromotedKnowledgePackByInput(store, tenantId, diseaseInput) {
  const normalizedInput = normalizeDiseaseInput(diseaseInput);

  return listPromotedKnowledgePacks(store, tenantId).find((knowledgePack) => (
    collectKnowledgePackLookupTerms(knowledgePack).includes(normalizedInput)
  )) ?? null;
}

/**
 * @param {any} knowledgePack
 * @param {string} workflowRunId
 * @returns {any}
 */
function ensureKnowledgePackLifecycle(knowledgePack, workflowRunId) {
  return {
    schemaVersion: knowledgePack.schemaVersion ?? SCHEMA_VERSION,
    ...clone(knowledgePack),
    packStatus: knowledgePack.packStatus ?? 'seeded',
    packScope: knowledgePack.packScope ?? 'library',
    generationMode: knowledgePack.generationMode ?? 'seeded',
    derivedFromRunId: knowledgePack.derivedFromRunId ?? workflowRunId,
    sourceOrigins: knowledgePack.sourceOrigins ?? {
      seeded: Array.isArray(knowledgePack.sourceCatalog) ? knowledgePack.sourceCatalog.length : 0,
      'user-doc': 0,
      'agent-web': 0,
    },
    generatedAt: knowledgePack.generatedAt ?? new Date().toISOString(),
    generatedBy: knowledgePack.generatedBy ?? 'seed-library',
  };
}

/**
 * @param {{ store: PlatformStore, clinicalService: any, tenantId: string, diseaseInput: string }} options
 * @returns {{ canonicalDisease: any, promotedKnowledgePack?: any }}
 */
function resolveDiseaseInput(options) {
  const promotedKnowledgePack = findPromotedKnowledgePackByInput(
    options.store,
    options.tenantId,
    options.diseaseInput,
  );

  if (promotedKnowledgePack) {
    const normalizedInput = normalizeDiseaseInput(options.diseaseInput);
    const matchType = normalizeDiseaseInput(promotedKnowledgePack.canonicalDiseaseName) === normalizedInput
      ? 'exact'
      : 'alias';

    return {
      canonicalDisease: options.clinicalService.buildCanonicalDiseaseFromKnowledgePack(
        promotedKnowledgePack,
        options.diseaseInput,
        matchType,
      ),
      promotedKnowledgePack,
    };
  }

  return {
    canonicalDisease: options.clinicalService.canonicalizeDiseaseInput(options.diseaseInput),
  };
}

/**
 * @param {any[]} values
 * @returns {string[]}
 */
function collectUniqueClaimIds(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim().length > 0))];
}

/**
 * @param {unknown[]} values
 * @returns {string[]}
 */
function uniqueStrings(values) {
  /** @type {string[]} */
  const strings = [];

  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0 && !strings.includes(value)) {
      strings.push(value);
    }
  }

  return strings;
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
 * @param {{
 *   store: PlatformStore,
 *   schemaRegistry: any,
 *   workflowRun: any,
 *   project: any,
 *   diseasePacket: any,
 *   storyWorkbook: any,
 *   sceneCards: any[],
 *   panelPlans: any[],
 *   renderPrompts: any[],
 *   letteringMaps: any[],
 * }} options
 * @returns {{ workflowRun: any, renderingGuide: any, visualReferencePack: any, markdown: string }}
 */
function generateAndPersistRenderingGuide(options) {
  if (!options.diseasePacket || !options.storyWorkbook || options.panelPlans.length === 0 || options.renderPrompts.length === 0 || options.letteringMaps.length === 0) {
    throw createHttpError(409, 'Rendering guide generation requires a disease packet, workbook, panel plans, render prompts, and lettering maps.');
  }

  const generatedAt = new Date().toISOString();
  const draftRenderingGuide = buildRenderingGuide({
    workflowRun: options.workflowRun,
    project: options.project,
    diseasePacket: options.diseasePacket,
    storyWorkbook: options.storyWorkbook,
    sceneCards: options.sceneCards,
    panelPlans: options.panelPlans,
    renderPrompts: options.renderPrompts,
    letteringMaps: options.letteringMaps,
    generatedAt,
  });
  const visualReferencePack = buildVisualReferencePack({
    workflowRun: options.workflowRun,
    renderingGuide: draftRenderingGuide,
    generatedAt,
  });
  const renderingGuide = applyVisualReferencePackToRenderingGuide(
    draftRenderingGuide,
    visualReferencePack,
    'not-reviewed',
  );
  const markdown = renderRenderingGuideMarkdown(renderingGuide);
  const markdownDocument = options.store.saveDocument(
    'rendering-guide-markdown',
    renderingGuide.id,
    markdown,
    {
      tenantId: options.workflowRun.tenantId,
      contentType: 'text/markdown',
      extension: 'md',
      retentionClass: 'approved-artifact',
    },
  );
  renderingGuide.markdownDocumentId = renderingGuide.id;
  renderingGuide.markdownLocation = markdownDocument.location;

  let workflowRun = persistArtifact(
    options.store,
    options.schemaRegistry,
    options.workflowRun,
    'rendering-guide',
    'contracts/rendering-guide.schema.json',
    renderingGuide,
  );
  workflowRun = persistArtifact(
    options.store,
    options.schemaRegistry,
    workflowRun,
    'visual-reference-pack',
    'contracts/visual-reference-pack.schema.json',
    visualReferencePack,
  );

  return {
    workflowRun,
    renderingGuide,
    visualReferencePack,
    markdown,
  };
}

/**
 * @param {{ store: PlatformStore, workflowRun: any }} options
 * @returns {{ renderingGuide: any, markdown: string } | null}
 */
function loadRenderingGuidePayload(options) {
  const renderingGuide = loadLatestArtifact(options.store, options.workflowRun, 'rendering-guide');

  if (!renderingGuide) {
    return null;
  }

  const markdown = options.store.getDocument('rendering-guide-markdown', renderingGuide.markdownDocumentId);

  return {
    renderingGuide,
    markdown: markdown ?? '',
  };
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
 * @returns {any[]}
 */
function listRenderJobsForRun(store, workflowRun) {
  return listTenantArtifactsByType(store, 'render-job', workflowRun.tenantId)
    .filter((renderJob) => renderJob.workflowRunId === workflowRun.id)
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
}

/**
 * @param {PlatformStore} store
 * @param {any} workflowRun
 * @returns {any | null}
 */
function getLatestRenderedAssetManifest(store, workflowRun) {
  return loadLatestArtifact(store, workflowRun, 'rendered-asset-manifest');
}

/**
 * @param {PlatformStore} store
 * @param {any} workflowRun
 * @returns {any | null}
 */
function getLatestVisualReferencePack(store, workflowRun) {
  return loadLatestArtifact(store, workflowRun, 'visual-reference-pack');
}

/**
 * @param {PlatformStore} store
 * @param {any} workflowRun
 * @returns {any | null}
 */
function getLatestRenderGuideReviewDecision(store, workflowRun) {
  return loadLatestArtifact(store, workflowRun, 'render-guide-review-decision');
}

/**
 * @param {any | null} renderingGuide
 * @param {any | null} visualReferencePack
 * @returns {string[]}
 */
function collectRenderingGuideWarnings(renderingGuide, visualReferencePack) {
  const warnings = [
    ...(visualReferencePack?.coverageSummary?.warnings ?? []),
  ];

  if (!renderingGuide) {
    warnings.push('No rendering guide is available yet.');
  }

  if (!visualReferencePack) {
    warnings.push('No visual reference pack is available yet.');
  }

  if (visualReferencePack?.coverageSummary?.presentCharacterItems < visualReferencePack?.coverageSummary?.requiredCharacterItems) {
    warnings.push('Detective Cyto Kine and Deputy Pip must both have explicit visual reference items before rendering.');
  }

  if (visualReferencePack?.coverageSummary?.missingPanelReferenceCount > 0) {
    warnings.push(`${visualReferencePack.coverageSummary.missingPanelReferenceCount} panel(s) are missing visual reference item coverage.`);
  }

  return [...new Set(warnings)];
}

/**
 * @param {PlatformStore} store
 * @param {any} workflowRun
 * @returns {{ approved: boolean, status: string, renderingGuide: any | null, visualReferencePack: any | null, reviewDecision: any | null, renderDisabledReason: string, guideWarnings: string[] }}
 */
function getRenderGuideGateState(store, workflowRun) {
  const renderingGuide = loadLatestArtifact(store, workflowRun, 'rendering-guide');
  const visualReferencePack = getLatestVisualReferencePack(store, workflowRun);
  const reviewDecision = getLatestRenderGuideReviewDecision(store, workflowRun);
  const guideWarnings = collectRenderingGuideWarnings(renderingGuide, visualReferencePack);

  if (!renderingGuide) {
    return {
      approved: false,
      status: 'missing-guide',
      renderingGuide,
      visualReferencePack,
      reviewDecision,
      renderDisabledReason: 'Rendering is disabled until the rendering guide is generated.',
      guideWarnings,
    };
  }

  if (!visualReferencePack) {
    return {
      approved: false,
      status: 'missing-reference-pack',
      renderingGuide,
      visualReferencePack,
      reviewDecision,
      renderDisabledReason: 'Rendering is disabled until the visual reference pack is generated.',
      guideWarnings,
    };
  }

  if (!reviewDecision) {
    return {
      approved: false,
      status: 'not-reviewed',
      renderingGuide,
      visualReferencePack,
      reviewDecision,
      renderDisabledReason: 'Rendering is disabled until the full guide and visual reference pack are reviewed and approved.',
      guideWarnings,
    };
  }

  const decisionMatchesLatest = reviewDecision.renderingGuideId === renderingGuide.id
    && reviewDecision.visualReferencePackId === visualReferencePack.id
    && renderingGuide.visualReferencePackId === visualReferencePack.id
    && visualReferencePack.renderingGuideId === renderingGuide.id;

  if (!decisionMatchesLatest || renderingGuide.reviewStatus === 'stale' || visualReferencePack.approvalStatus === 'stale') {
    return {
      approved: false,
      status: 'stale',
      renderingGuide,
      visualReferencePack,
      reviewDecision,
      renderDisabledReason: 'Rendering is disabled because the latest guide or visual reference pack changed after approval.',
      guideWarnings,
    };
  }

  if (reviewDecision.decision !== 'approved') {
    return {
      approved: false,
      status: reviewDecision.decision,
      renderingGuide,
      visualReferencePack,
      reviewDecision,
      renderDisabledReason: `Rendering is disabled because the latest guide review decision is ${reviewDecision.decision}.`,
      guideWarnings,
    };
  }

  const approved = renderingGuide.reviewStatus === 'approved' && visualReferencePack.approvalStatus === 'approved';

  return {
    approved,
    status: approved ? 'approved' : 'stale',
    renderingGuide,
    visualReferencePack,
    reviewDecision,
    renderDisabledReason: approved
      ? ''
      : 'Rendering is disabled because the guide and visual reference pack approval state is not current.',
    guideWarnings,
  };
}

/**
 * @param {PlatformStore} store
 * @param {any} workflowRun
 * @returns {{ renderingGuide: any, visualReferencePack: any, reviewDecision: any }}
 */
function assertRenderGuideApprovedForRender(store, workflowRun) {
  const gateState = getRenderGuideGateState(store, workflowRun);

  if (!gateState.approved) {
    throw createHttpError(409, gateState.renderDisabledReason, {
      gateStatus: gateState.status,
      guideWarnings: gateState.guideWarnings,
    });
  }

  return {
    renderingGuide: gateState.renderingGuide,
    visualReferencePack: gateState.visualReferencePack,
    reviewDecision: gateState.reviewDecision,
  };
}

/**
 * @param {PlatformStore} store
 * @param {any} workflowRun
 * @returns {number}
 */
function getActiveWorkItemCount(store, workflowRun) {
  return listWorkItemsForRun(store, workflowRun)
    .filter((workItem) => workItem.status === 'queued' || workItem.status === 'in-progress' || workItem.status === 'escalated')
    .length;
}

/**
 * @param {PlatformStore} store
 * @param {any} workflowRun
 * @returns {number}
 */
function getOverdueWorkItemCount(store, workflowRun) {
  return listWorkItemsForRun(store, workflowRun)
    .filter((workItem) => isWorkItemOverdue(workItem))
    .length;
}

/**
 * @param {PlatformStore} store
 * @param {any} workflowRun
 * @returns {number}
 */
function getThreadCount(store, workflowRun) {
  return listReviewThreadsForRun(store, workflowRun).length;
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
        ...(['rendered-asset-manifest', 'rendering-guide', 'visual-reference-pack', 'render-guide-review-decision'].includes(artifactReference.artifactType)
          ? { payload: store.getArtifact(artifactReference.artifactType, artifactReference.artifactId) }
          : {}),
      };
    });
}

/**
 * @param {{ store: PlatformStore, schemaRegistry: any, workflowRun: any }} options
 * @returns {{ workflowRun: any, renderingGuide: any, markdown: string }}
 */
function regenerateRenderingGuideForRun(options) {
  const project = getProjectForRun(options.store, options.workflowRun);
  const diseasePacket = loadLatestArtifact(options.store, options.workflowRun, 'disease-packet');
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

  return generateAndPersistRenderingGuide({
    store: options.store,
    schemaRegistry: options.schemaRegistry,
    workflowRun: options.workflowRun,
    project,
    diseasePacket,
    storyWorkbook,
    sceneCards,
    panelPlans,
    renderPrompts,
    letteringMaps,
  });
}

/**
 * @param {{ store: PlatformStore, schemaRegistry: any, workflowRun: any }} options
 * @returns {{ workflowRun: any, renderingGuide: any, visualReferencePack: any, markdown: string }}
 */
function regenerateVisualReferencePackForRun(options) {
  const guidePayload = loadRenderingGuidePayload({
    store: options.store,
    workflowRun: options.workflowRun,
  });

  if (!guidePayload) {
    throw createHttpError(409, 'A rendering guide must exist before the visual reference pack can be regenerated.');
  }

  const generatedAt = new Date().toISOString();
  const visualReferencePack = buildVisualReferencePack({
    workflowRun: options.workflowRun,
    renderingGuide: guidePayload.renderingGuide,
    generatedAt,
  });
  const renderingGuide = applyVisualReferencePackToRenderingGuide(
    {
      ...guidePayload.renderingGuide,
      reviewStatus: 'not-reviewed',
    },
    visualReferencePack,
    'not-reviewed',
  );
  const markdown = renderRenderingGuideMarkdown(renderingGuide);
  const markdownDocument = options.store.saveDocument(
    'rendering-guide-markdown',
    renderingGuide.markdownDocumentId ?? renderingGuide.id,
    markdown,
    {
      tenantId: options.workflowRun.tenantId,
      contentType: 'text/markdown',
      extension: 'md',
      retentionClass: 'approved-artifact',
    },
  );
  renderingGuide.markdownDocumentId = renderingGuide.markdownDocumentId ?? renderingGuide.id;
  renderingGuide.markdownLocation = markdownDocument.location;
  assertSchema(options.schemaRegistry, 'contracts/rendering-guide.schema.json', renderingGuide);
  options.store.saveArtifact('rendering-guide', renderingGuide.id, renderingGuide, {
    tenantId: options.workflowRun.tenantId,
  });
  let workflowRun = persistArtifact(
    options.store,
    options.schemaRegistry,
    options.workflowRun,
    'visual-reference-pack',
    'contracts/visual-reference-pack.schema.json',
    visualReferencePack,
  );
  workflowRun = ensureRenderGuideReviewWorkItem({
    store: options.store,
    schemaRegistry: options.schemaRegistry,
    workflowRun: saveWorkflowRunRecord(
      options.store,
      options.schemaRegistry,
      withPauseReason(workflowRun, 'render-guide-review-required'),
    ),
  });

  return {
    workflowRun,
    renderingGuide,
    visualReferencePack,
    markdown,
  };
}

/**
 * @param {{ store: PlatformStore, schemaRegistry: any, workflowRun: any, actor: any, payload: any }} options
 * @returns {{ workflowRun: any, decision: any, renderingGuide: any, visualReferencePack: any }}
 */
function submitRenderGuideReviewDecision(options) {
  if (!isRecord(options.payload)) {
    throw createHttpError(400, 'Render guide review decision payload must be an object.');
  }

  if (!['approved', 'changes-requested', 'rejected'].includes(String(options.payload.decision))) {
    throw createHttpError(400, 'Render guide review decision must be approved, changes-requested, or rejected.');
  }

  const gateState = getRenderGuideGateState(options.store, options.workflowRun);

  if (!gateState.renderingGuide || !gateState.visualReferencePack) {
    throw createHttpError(409, 'A rendering guide and visual reference pack are required before review decisions can be recorded.');
  }

  const decisionValue = /** @type {'approved' | 'changes-requested' | 'rejected'} */ (options.payload.decision);
  const timestamp = new Date().toISOString();
  const decision = {
    schemaVersion: SCHEMA_VERSION,
    id: createId('rgd'),
    tenantId: options.workflowRun.tenantId,
    workflowRunId: options.workflowRun.id,
    renderingGuideId: gateState.renderingGuide.id,
    visualReferencePackId: gateState.visualReferencePack.id,
    decision: decisionValue,
    reviewerId: options.actor.id,
    reviewerRoles: options.actor.roles ?? [],
    ...(typeof options.payload.comment === 'string' && options.payload.comment.trim()
      ? { comment: options.payload.comment.trim() }
      : {}),
    ...(Array.isArray(options.payload.requiredChanges)
      ? { requiredChanges: options.payload.requiredChanges.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()) }
      : {}),
    createdAt: timestamp,
  };
  assertSchema(options.schemaRegistry, 'contracts/render-guide-review-decision.schema.json', decision);
  const reviewStatus = decisionValue;
  const renderingGuide = {
    ...gateState.renderingGuide,
    reviewStatus,
  };
  const markdown = renderRenderingGuideMarkdown(renderingGuide);
  const markdownDocument = options.store.saveDocument(
    'rendering-guide-markdown',
    renderingGuide.markdownDocumentId ?? renderingGuide.id,
    markdown,
    {
      tenantId: options.workflowRun.tenantId,
      contentType: 'text/markdown',
      extension: 'md',
      retentionClass: 'approved-artifact',
    },
  );
  renderingGuide.markdownDocumentId = renderingGuide.markdownDocumentId ?? renderingGuide.id;
  renderingGuide.markdownLocation = markdownDocument.location;
  const visualReferencePack = {
    ...gateState.visualReferencePack,
    approvalStatus: reviewStatus,
    items: (gateState.visualReferencePack.items ?? []).map((/** @type {any} */ item) => ({
      ...item,
      approvalStatus: decisionValue === 'approved' ? 'approved' : decisionValue,
    })),
  };
  assertSchema(options.schemaRegistry, 'contracts/rendering-guide.schema.json', renderingGuide);
  assertSchema(options.schemaRegistry, 'contracts/visual-reference-pack.schema.json', visualReferencePack);
  options.store.saveArtifact('rendering-guide', renderingGuide.id, renderingGuide, {
    tenantId: options.workflowRun.tenantId,
  });
  options.store.saveArtifact('visual-reference-pack', visualReferencePack.id, visualReferencePack, {
    tenantId: options.workflowRun.tenantId,
  });
  let workflowRun = persistArtifact(
    options.store,
    options.schemaRegistry,
    options.workflowRun,
    'render-guide-review-decision',
    'contracts/render-guide-review-decision.schema.json',
    decision,
    decisionValue === 'approved' ? 'approved' : 'rejected',
  );
  if (decisionValue === 'approved') {
    workflowRun = completeRenderGuideReviewWorkItems({
      store: options.store,
      schemaRegistry: options.schemaRegistry,
      workflowRun,
      visualReferencePackId: visualReferencePack.id,
    });
  }
  workflowRun = saveWorkflowRunRecord(
    options.store,
    options.schemaRegistry,
    withPauseReason(workflowRun, decisionValue === 'approved' ? undefined : 'render-guide-review-required'),
  );
  appendAuditLog(
    options.store,
    options.schemaRegistry,
    options.actor,
    'rendering-guide.review',
    'workflow-run',
    workflowRun.id,
    'success',
    `Rendering guide review decision recorded as ${decisionValue}.`,
    {
      renderingGuideId: renderingGuide.id,
      visualReferencePackId: visualReferencePack.id,
      decisionId: decision.id,
      decision: decisionValue,
    },
  );

  return {
    workflowRun,
    decision,
    renderingGuide,
    visualReferencePack,
  };
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
 * @param {string} body
 * @returns {string[]}
 */
function extractMentionStrings(body) {
  return uniqueStrings([...body.matchAll(/@([A-Za-z0-9._:-]+)/g)].map((match) => match[1]));
}

/**
 * @param {{ store: PlatformStore, actor: any }} options
 * @returns {any[]}
 */
function listNotificationsForActor(options) {
  const actorMentions = new Set([
    options.actor.id,
    normalizeDiseaseInput(options.actor.displayName ?? ''),
  ].filter(Boolean));

  return listTenantArtifactsByType(options.store, 'notification', options.actor.tenantId)
    .filter((notification) => {
      if (typeof notification.targetActorId === 'string' && notification.targetActorId === options.actor.id) {
        return true;
      }

      return typeof notification.targetActorId === 'string' && actorMentions.has(normalizeDiseaseInput(notification.targetActorId));
    })
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
}

/**
 * @param {{
 *   store: PlatformStore,
 *   schemaRegistry: any,
 *   workflowRun: any,
 *   actor: any,
 *   threadId: string,
 *   workItemId?: string,
 *   subjectType: string,
 *   subjectId: string,
 *   body: string,
 *   mentions?: string[],
 *   mentionedActorIds?: string[],
 * }} options
 * @returns {any[]}
 */
function createMentionNotifications(options) {
  const targetActorIds = uniqueStrings([
    ...(options.mentions ?? []),
    ...(options.mentionedActorIds ?? []),
    ...extractMentionStrings(options.body),
  ]);

  return targetActorIds.map((targetActorId) => {
    const notification = {
      schemaVersion: SCHEMA_VERSION,
      id: createId('ntf'),
      tenantId: options.workflowRun.tenantId,
      targetActorId,
      workflowRunId: options.workflowRun.id,
      ...(options.threadId ? { threadId: options.threadId } : {}),
      ...(options.workItemId ? { workItemId: options.workItemId } : {}),
      notificationType: 'mention',
      status: 'unread',
      message: `${options.actor.displayName} mentioned ${targetActorId}: ${options.body.slice(0, 160)}`,
      subjectType: options.subjectType,
      subjectId: options.subjectId,
      createdBy: options.actor.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    assertSchema(options.schemaRegistry, 'contracts/notification.schema.json', notification);
    options.store.saveArtifact('notification', notification.id, notification, {
      tenantId: options.workflowRun.tenantId,
    });
    return notification;
  });
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
 *   knowledgePack?: any,
 * }} options
 * @returns {any}
 */
function buildClinicalPackageForRun(options) {
  const knowledgePack = options.knowledgePack
    ? ensureKnowledgePackLifecycle(options.knowledgePack, options.workflowRun.id)
    : ensureKnowledgePackLifecycle(
      loadLatestKnowledgePackForRun(options.store, options.workflowRun)
        ?? options.clinicalService.getKnowledgePack(options.canonicalDisease.canonicalDiseaseName),
      options.workflowRun.id,
    );
  const governanceState = loadClinicalGovernanceState(
    options.store,
    options.workflowRun,
    knowledgePack.canonicalDiseaseName,
  );
  const clinicalPackage = options.clinicalService.buildClinicalPackageFromKnowledgePack(
    knowledgePack,
    governanceState,
  );

  return {
    ...clinicalPackage,
    evidenceRelationships: clinicalPackage.evidenceGraph.edges,
    knowledgePack,
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
  const knowledgePack = ensureKnowledgePackLifecycle(
    loadLatestKnowledgePackForRun(options.store, options.workflowRun)
      ?? options.clinicalService.getKnowledgePack(canonicalDisease.canonicalDiseaseName),
    options.workflowRun.id,
  );

  const governanceState = loadClinicalGovernanceState(
    options.store,
    options.workflowRun,
    knowledgePack.canonicalDiseaseName,
  );
  const generatedClinicalPackage = options.clinicalService.buildClinicalPackageFromKnowledgePack(
    knowledgePack,
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
    knowledgePack,
    sourceRecords: generatedClinicalPackage.sourceRecords,
    evidenceRecords: generatedClinicalPackage.evidenceRecords,
    evidenceRelationships: evidenceGraph.edges,
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
    'disease-knowledge-pack',
    'contracts/disease-knowledge-pack.schema.json',
    options.clinicalPackage.knowledgePack,
    options.clinicalPackage.knowledgePack.packStatus === 'promoted' ? 'approved' : 'generated',
  );
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
 * @param {{ store: PlatformStore, schemaRegistry: any, workflowRun: any, actor: any, canonicalDiseaseName: string, sourceId: string, decision: string, reason?: string, notes?: string[], supersededBy?: string }} options
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

  if (typeof options.supersededBy === 'string' && options.supersededBy) {
    governanceDecision.supersededBy = options.supersededBy;
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
 * @param {{ store: PlatformStore, schemaRegistry: any, actor: any, tenantId: string, sourceId: string, canonicalDiseaseName: string, primaryOwnerRole: string, backupOwnerRole: string, notes?: string[] }} options
 * @returns {any}
 */
function saveSourceOwnerAssignment(options) {
  const timestamp = new Date().toISOString();
  const sourceOwnerAssignment = {
    schemaVersion: SCHEMA_VERSION,
    id: createId('soa'),
    tenantId: options.tenantId,
    sourceId: options.sourceId,
    canonicalDiseaseName: options.canonicalDiseaseName,
    primaryOwnerRole: options.primaryOwnerRole,
    backupOwnerRole: options.backupOwnerRole,
    assignedBy: options.actor.id,
    assignedAt: timestamp,
    ...(Array.isArray(options.notes) && options.notes.length > 0 ? { notes: options.notes } : {}),
  };

  assertSchema(options.schemaRegistry, 'contracts/source-owner-assignment.schema.json', sourceOwnerAssignment);
  options.store.saveArtifact('source-owner-assignment', sourceOwnerAssignment.id, sourceOwnerAssignment, {
    tenantId: options.tenantId,
  });

  return sourceOwnerAssignment;
}

/**
 * @param {{ store: PlatformStore, schemaRegistry: any, actor: any, tenantId: string, workflowRunId?: string, sourceRecord: any, existingTask?: any | null, reason?: string }} options
 * @returns {{ workItem: any, refreshTask: any }}
 */
function saveSourceRefreshTask(options) {
  const actorId = options.actor?.id ?? 'clinical-governance-system';
  const workItem = buildWorkItem({
    tenantId: options.tenantId,
    workflowRunId: options.workflowRunId,
    workType: 'source-refresh',
    queueName: 'source-governance',
    subjectType: 'source-record',
    subjectId: options.sourceRecord.id,
    reason: options.sourceRecord.approvalStatus === 'suspended' ? 'blocked' : (options.sourceRecord.freshnessState ?? 'default'),
    priority: options.sourceRecord.approvalStatus === 'suspended' ? 'critical' : 'high',
    originType: 'source-refresh-task',
    originId: options.existingTask?.id,
    notes: options.reason ? [options.reason] : (options.sourceRecord.governanceNotes ?? []),
    metadata: {
      canonicalDiseaseName: options.sourceRecord.canonicalDiseaseName,
      sourceLabel: options.sourceRecord.sourceLabel,
      requestedBy: actorId,
    },
    existingWorkItem: options.existingTask?.workItemId
      ? options.store.getArtifact('work-item', options.existingTask.workItemId)
      : null,
  });
  assertSchema(options.schemaRegistry, 'contracts/work-item.schema.json', workItem);
  options.store.saveArtifact('work-item', workItem.id, workItem, {
    tenantId: options.tenantId,
  });

  const timestamp = new Date().toISOString();
  const refreshTask = {
    schemaVersion: SCHEMA_VERSION,
    id: options.existingTask?.id ?? createId('srt'),
    tenantId: options.tenantId,
    workflowRunId: options.workflowRunId,
    sourceId: options.sourceRecord.id,
    canonicalDiseaseName: options.sourceRecord.canonicalDiseaseName,
    status: options.existingTask?.status ?? 'open',
    reason: options.reason ?? `Refresh ${options.sourceRecord.sourceLabel} for ${options.sourceRecord.freshnessState}.`,
    freshnessState: options.sourceRecord.freshnessState,
    workItemId: workItem.id,
    nextReviewDueAt: options.sourceRecord.nextReviewDueAt,
    createdAt: options.existingTask?.createdAt ?? timestamp,
    updatedAt: timestamp,
    completedAt: options.existingTask?.completedAt,
  };
  assertSchema(options.schemaRegistry, 'contracts/source-refresh-task.schema.json', refreshTask);
  options.store.saveArtifact('source-refresh-task', refreshTask.id, refreshTask, {
    tenantId: options.tenantId,
  });

  return {
    workItem,
    refreshTask,
  };
}

/**
 * @param {PlatformStore} store
 * @param {any} workflowRun
 * @returns {any[]}
 */
function listKnowledgePackPromotionDecisionsForRun(store, workflowRun) {
  return listTenantArtifactsByType(store, 'knowledge-pack-promotion-decision', workflowRun.tenantId)
    .filter((decision) => decision.workflowRunId === workflowRun.id)
    .sort((left, right) => String(left.decidedAt).localeCompare(String(right.decidedAt)));
}

/**
 * @param {PlatformStore} store
 * @param {any} workflowRun
 * @returns {any | null}
 */
function getLatestKnowledgePackPromotionDecision(store, workflowRun) {
  return listKnowledgePackPromotionDecisionsForRun(store, workflowRun).at(-1) ?? null;
}

/**
 * @param {PlatformStore} store
 * @param {any} workflowRun
 * @returns {boolean}
 */
function requiresKnowledgePackDecision(store, workflowRun) {
  const knowledgePack = loadLatestKnowledgePackForRun(store, workflowRun);

  if (!knowledgePack || knowledgePack.packStatus !== 'provisional') {
    return false;
  }

  const latestDecision = getLatestKnowledgePackPromotionDecision(store, workflowRun);
  return !latestDecision || latestDecision.decision === 'rejected';
}

/**
 * @param {{
 *   store: PlatformStore,
 *   schemaRegistry: any,
 *   workflowRun: any,
 *   actor: any,
 *   decision: 'approved-run-only' | 'promoted-to-library' | 'rejected',
 *   notes?: string,
 * }} options
 * @returns {{ workflowRun: any, decision: any, knowledgePack: any }}
 */
function saveKnowledgePackPromotionDecision(options) {
  const knowledgePack = loadLatestKnowledgePackForRun(options.store, options.workflowRun);

  if (!knowledgePack) {
    throw createHttpError(409, 'A disease knowledge pack is required before a reviewer can approve or promote it.');
  }

  const timestamp = new Date().toISOString();
  const decision = {
    schemaVersion: SCHEMA_VERSION,
    id: createId('kpd'),
    tenantId: options.workflowRun.tenantId,
    workflowRunId: options.workflowRun.id,
    knowledgePackId: knowledgePack.id,
    decision: options.decision,
    ...(typeof options.notes === 'string' && options.notes ? { notes: options.notes } : {}),
    decidedBy: options.actor.id,
    decidedByRoles: [...(options.actor.roles ?? [])],
    decidedAt: timestamp,
  };
  assertSchema(options.schemaRegistry, 'contracts/knowledge-pack-promotion-decision.schema.json', decision);
  options.store.saveArtifact('knowledge-pack-promotion-decision', decision.id, decision, {
    tenantId: options.workflowRun.tenantId,
  });
  let workflowRun = upsertArtifactReference(options.workflowRun, {
    artifactType: 'knowledge-pack-promotion-decision',
    artifactId: decision.id,
    status: options.decision === 'rejected' ? 'rejected' : 'approved',
  });

  if (options.decision === 'promoted-to-library') {
    const promotedKnowledgePack = {
      ...knowledgePack,
      packStatus: 'promoted',
      packScope: 'library',
      generatedAt: knowledgePack.generatedAt ?? timestamp,
    };
    workflowRun = persistArtifact(
      options.store,
      options.schemaRegistry,
      workflowRun,
      'disease-knowledge-pack',
      'contracts/disease-knowledge-pack.schema.json',
      promotedKnowledgePack,
      'approved',
    );
  }

  workflowRun = saveWorkflowRunRecord(
    options.store,
    options.schemaRegistry,
    withPauseReason(
      workflowRun,
      options.decision === 'rejected' ? 'provisional-knowledge-pack-review-required' : undefined,
    ),
  );

  appendAuditLog(
    options.store,
    options.schemaRegistry,
    options.actor,
    'knowledge-pack.decision',
    'workflow-run',
    workflowRun.id,
    'success',
    `Recorded ${options.decision} for disease knowledge pack ${knowledgePack.id}.`,
    {
      decisionId: decision.id,
      knowledgePackId: knowledgePack.id,
    },
  );

  return {
    workflowRun,
    decision,
    knowledgePack,
  };
}

/**
 * @param {{ store: PlatformStore, schemaRegistry: any, workflowRun: any, actor?: any }} options
 * @returns {any}
 */
function ensureKnowledgePackReviewWorkItem(options) {
  if (!requiresKnowledgePackDecision(options.store, options.workflowRun)) {
    return withPauseReason(options.workflowRun, undefined);
  }

  const knowledgePack = loadLatestKnowledgePackForRun(options.store, options.workflowRun);

  if (!knowledgePack) {
    return options.workflowRun;
  }

  const existingWorkItem = listWorkItemsForRun(options.store, options.workflowRun).find((workItem) => (
    workItem.subjectType === 'disease-knowledge-pack'
    && workItem.subjectId === knowledgePack.id
    && workItem.status !== 'completed'
    && workItem.status !== 'cancelled'
  ));
  const workItem = buildWorkItem({
    tenantId: options.workflowRun.tenantId,
    workflowRunId: options.workflowRun.id,
    workType: 'run-review',
    queueName: 'review-queue',
    subjectType: 'disease-knowledge-pack',
    subjectId: knowledgePack.id,
    reason: 'clinical-governance-review-required',
    priority: 'high',
    originType: 'knowledge-pack',
    originId: knowledgePack.id,
    notes: [
      `Provisional knowledge pack ${knowledgePack.canonicalDiseaseName} must be approved for this run or promoted to the shared library before export.`,
    ],
    existingWorkItem,
  });
  assertSchema(options.schemaRegistry, 'contracts/work-item.schema.json', workItem);
  options.store.saveArtifact('work-item', workItem.id, workItem, {
    tenantId: options.workflowRun.tenantId,
  });

  return saveWorkflowRunRecord(
    options.store,
    options.schemaRegistry,
    withPauseReason(
      upsertArtifactReference(options.workflowRun, {
        artifactType: 'work-item',
        artifactId: workItem.id,
        status: 'generated',
      }),
      'provisional-knowledge-pack-review-required',
    ),
  );
}

/**
 * @param {{ store: PlatformStore, schemaRegistry: any, workflowRun: any }} options
 * @returns {any}
 */
function ensureRenderGuideReviewWorkItem(options) {
  const renderingGuide = loadLatestArtifact(options.store, options.workflowRun, 'rendering-guide');
  const visualReferencePack = loadLatestArtifact(options.store, options.workflowRun, 'visual-reference-pack');

  if (!renderingGuide || !visualReferencePack) {
    return options.workflowRun;
  }

  const existingWorkItem = listWorkItemsForRun(options.store, options.workflowRun).find((workItem) => (
    workItem.subjectType === 'visual-reference-pack'
    && workItem.subjectId === visualReferencePack.id
    && workItem.status !== 'completed'
    && workItem.status !== 'cancelled'
  ));
  const workItem = buildWorkItem({
    tenantId: options.workflowRun.tenantId,
    workflowRunId: options.workflowRun.id,
    workType: 'run-review',
    queueName: 'review-queue',
    subjectType: 'visual-reference-pack',
    subjectId: visualReferencePack.id,
    reason: 'render-guide-review-required',
    priority: 'high',
    originType: 'rendering-guide',
    originId: renderingGuide.id,
    notes: [
      'Rendering is blocked until the full rendering guide, Cyto/Pip locks, recurring references, panel prompts, lettering separation, and medical traceability are approved.',
    ],
    existingWorkItem,
  });
  assertSchema(options.schemaRegistry, 'contracts/work-item.schema.json', workItem);
  options.store.saveArtifact('work-item', workItem.id, workItem, {
    tenantId: options.workflowRun.tenantId,
  });

  return saveWorkflowRunRecord(
    options.store,
    options.schemaRegistry,
    withPauseReason(
      upsertArtifactReference(options.workflowRun, {
        artifactType: 'work-item',
        artifactId: workItem.id,
        status: 'generated',
      }),
      'render-guide-review-required',
    ),
  );
}

/**
 * @param {{ store: PlatformStore, schemaRegistry: any, workflowRun: any, visualReferencePackId: string }} options
 * @returns {any}
 */
function completeRenderGuideReviewWorkItems(options) {
  let workflowRun = options.workflowRun;
  const timestamp = new Date().toISOString();

  for (const workItem of listWorkItemsForRun(options.store, workflowRun)) {
    if (workItem.subjectType !== 'visual-reference-pack' || workItem.subjectId !== options.visualReferencePackId) {
      continue;
    }

    if (workItem.status === 'completed' || workItem.status === 'cancelled') {
      continue;
    }

    const updatedWorkItem = {
      ...workItem,
      status: 'completed',
      completedAt: timestamp,
      updatedAt: timestamp,
    };
    assertSchema(options.schemaRegistry, 'contracts/work-item.schema.json', updatedWorkItem);
    options.store.saveArtifact('work-item', updatedWorkItem.id, updatedWorkItem, {
      tenantId: workflowRun.tenantId,
    });
    workflowRun = upsertArtifactReference(workflowRun, {
      artifactType: 'work-item',
      artifactId: updatedWorkItem.id,
      status: 'generated',
    });
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
    actor: options.actor,
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
    'research-brief',
    'source-harvest',
    'knowledge-pack-build-report',
    'disease-knowledge-pack',
    'knowledge-pack-promotion-decision',
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

  const project = options.store.getProject(workflowRun.projectId);

  if (!project) {
    throw createHttpError(500, `Project ${workflowRun.projectId} could not be loaded for rendering guide generation.`);
  }

  workflowRun = generateAndPersistRenderingGuide({
    store: options.store,
    schemaRegistry: options.schemaRegistry,
    workflowRun,
    project,
    diseasePacket: options.diseasePacket,
    storyWorkbook: storyWorkbookPackage.storyWorkbook,
    sceneCards: visualPlanningPackage.sceneCards,
    panelPlans: visualPlanningPackage.panelPlans,
    renderPrompts: visualPlanningPackage.renderPrompts,
    letteringMaps: visualPlanningPackage.letteringMaps,
  }).workflowRun;

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

  const reviewPausedRun = transitionWorkflow(
    options.store,
    options.schemaRegistry,
    options.workflowSpec,
    workflowRun,
    {
      eventType: 'REQUEST_REVIEW',
      actor: {
        type: 'system',
        id: 'render-prep-stage',
      },
      payload: {
        renderPromptIds: visualPlanningPackage.renderPrompts.map((/** @type {{ id: string }} */ renderPrompt) => renderPrompt.id),
        letteringMapIds: visualPlanningPackage.letteringMaps.map((/** @type {{ id: string }} */ letteringMap) => letteringMap.id),
        qaReportId: visualPlanningPackage.qaReport.id,
        pauseReason: 'render-guide-review-required',
      },
      notes: `Generated ${visualPlanningPackage.renderPrompts.length} render prompts with separate lettering maps. Rendering is paused until the full rendering guide and visual reference pack are reviewed and approved.`,
    },
  );
  return ensureRenderGuideReviewWorkItem({
    store: options.store,
    schemaRegistry: options.schemaRegistry,
    workflowRun: saveWorkflowRunRecord(
      options.store,
      options.schemaRegistry,
      withPauseReason(reviewPausedRun, 'render-guide-review-required'),
    ),
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
 *   knowledgePack?: any,
 *   allowReviewRequiredStoryContinuation?: boolean,
  *   actor?: any,
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
    knowledgePack: options.knowledgePack,
  });

  workflowRun = persistClinicalArtifacts({
    store: options.store,
    schemaRegistry: options.schemaRegistry,
    workflowRun,
    clinicalPackage,
  });
  ensureClinicalGovernanceTasks({
    store: options.store,
    schemaRegistry: options.schemaRegistry,
    workflowRun,
    actor: options.actor,
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

  const allowsProvisionalContinuation = options.allowReviewRequiredStoryContinuation === true;

  if (clinicalPackage.diseasePacket.evidenceSummary.governanceVerdict === 'review-required' && !allowsProvisionalContinuation) {
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
      notes: allowsProvisionalContinuation
        ? 'Clinical package generated from a provisional knowledge pack and cleared the draft threshold for downstream story work.'
        : 'Clinical package generated and approved for downstream story work.',
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
 *   actor?: any,
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

  workflowRun = transitionWorkflow(
    options.store,
    options.schemaRegistry,
    options.workflowSpec,
    workflowRun,
    {
      eventType: 'STAGE_PASSED',
      actor: {
        type: 'system',
        id: 'research-assembly-stage',
      },
      payload: {
        resolutionMode: 'governed-library',
      },
      notes: 'Existing governed knowledge pack found. Research assembly used the approved library path.',
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
    actor: options.actor,
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
 *   researchAssemblyService: any,
 *   actor?: any,
 * }} options
 * @returns {Promise<any>}
 */
async function continueNewDiseasePipeline(options) {
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
        resolutionStatus: 'new-disease',
      },
      notes: `No governed pack matched ${options.workflowInput.diseaseName}; starting research assembly for a provisional knowledge pack.`,
    },
  );

  const researchAssembly = await options.researchAssemblyService.compileProvisionalKnowledgePack({
    workflowRun,
    workflowInput: options.workflowInput,
    canonicalDisease: options.canonicalDisease,
    actor: options.actor,
  });

  workflowRun = persistArtifact(
    options.store,
    options.schemaRegistry,
    workflowRun,
    'research-brief',
    'contracts/research-brief.schema.json',
    researchAssembly.researchBrief,
  );
  workflowRun = persistArtifact(
    options.store,
    options.schemaRegistry,
    workflowRun,
    'source-harvest',
    'contracts/source-harvest.schema.json',
    researchAssembly.sourceHarvest,
  );
  workflowRun = persistArtifact(
    options.store,
    options.schemaRegistry,
    workflowRun,
    'knowledge-pack-build-report',
    'contracts/knowledge-pack-build-report.schema.json',
    researchAssembly.buildReport,
    researchAssembly.buildReport.status === 'blocked' ? 'rejected' : 'generated',
  );
  workflowRun = persistArtifact(
    options.store,
    options.schemaRegistry,
    workflowRun,
    'disease-knowledge-pack',
    'contracts/disease-knowledge-pack.schema.json',
    researchAssembly.knowledgePack,
    'generated',
  );

  const resolvedCanonicalDisease = options.clinicalService.buildCanonicalDiseaseFromKnowledgePack(
    researchAssembly.knowledgePack,
    options.workflowInput.diseaseName,
  );

  workflowRun = persistArtifact(
    options.store,
    options.schemaRegistry,
    workflowRun,
    'canonical-disease',
    'contracts/canonical-disease.schema.json',
    resolvedCanonicalDisease,
  );

  if (!researchAssembly.buildReport.fitForStoryContinuation || researchAssembly.buildReport.status === 'blocked') {
    workflowRun = transitionWorkflow(
      options.store,
      options.schemaRegistry,
      options.workflowSpec,
      workflowRun,
      {
        eventType: 'STAGE_FAILED',
        actor: {
          type: 'system',
          id: 'research-assembly-stage',
        },
        payload: {
          researchBriefId: researchAssembly.researchBrief.id,
          sourceHarvestId: researchAssembly.sourceHarvest.id,
          buildReportId: researchAssembly.buildReport.id,
          knowledgePackId: researchAssembly.knowledgePack.id,
        },
        notes: researchAssembly.buildReport.blockingIssues.join(' ') || 'Research assembly could not produce a safe provisional knowledge pack.',
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
    workflowRun,
    {
      eventType: 'STAGE_PASSED',
      actor: {
        type: 'system',
        id: 'research-assembly-stage',
      },
      payload: {
        researchBriefId: researchAssembly.researchBrief.id,
        sourceHarvestId: researchAssembly.sourceHarvest.id,
        buildReportId: researchAssembly.buildReport.id,
        knowledgePackId: researchAssembly.knowledgePack.id,
      },
      notes: `Research assembly compiled a provisional knowledge pack for ${researchAssembly.knowledgePack.canonicalDiseaseName}.`,
    },
  );

  return continueClinicalStage({
    store: options.store,
    schemaRegistry: options.schemaRegistry,
    workflowSpec: options.workflowSpec,
    workflowRun,
    workflowInput: options.workflowInput,
    canonicalDisease: resolvedCanonicalDisease,
    clinicalService: options.clinicalService,
    storyEngineService: options.storyEngineService,
    knowledgePack: researchAssembly.knowledgePack,
    allowReviewRequiredStoryContinuation: true,
    actor: options.actor,
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
    actor: options.actor,
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
      title: 'Rendering guide',
      description: 'Provider-fitted master handoff guide with one-panel-per-slide external rendering instructions.',
      artifacts: groupedArtifacts.get('rendering-guide') ?? [],
    },
    {
      title: 'Lettering maps',
      artifacts: groupedArtifacts.get('lettering-map') ?? [],
    },
    {
      title: 'External rendered art attachments',
      description: 'Optional externally rendered assets and manifests attached back to the run.',
      artifacts: [
        ...(groupedArtifacts.get('render-job') ?? []),
        ...(groupedArtifacts.get('render-attempt') ?? []),
        ...(groupedArtifacts.get('rendered-asset') ?? []),
        ...(groupedArtifacts.get('rendered-asset-manifest') ?? []),
      ],
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
 * @param {Map<string, {
 *   exportCount: number,
 *   latestEvalStatus: string,
 *   assignees: string[],
 *   openCommentCount: number,
 *   activeAssignmentCount: number,
 *   activeWorkItemCount: number,
 *   overdueWorkItemCount: number,
 *   reviewAssignments: any[],
 *   workItems?: any[],
 * }>} runSummaries
 * @param {{ disease?: string, state?: string, stage?: string, assignee?: string, exportStatus?: string, evalStatus?: string, queueStatus?: string, workType?: string, sort?: string }} filters
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
      assignees: [],
      openCommentCount: 0,
      activeAssignmentCount: 0,
      activeWorkItemCount: 0,
      overdueWorkItemCount: 0,
      reviewAssignments: [],
      workItems: [],
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

    if (filters.assignee && !matchesAssignmentFilter(runSummary.reviewAssignments ?? [], filters.assignee)) {
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

    if (filters.queueStatus === 'overdue' && runSummary.overdueWorkItemCount === 0) {
      return false;
    }

    if (filters.queueStatus === 'active' && runSummary.activeWorkItemCount === 0) {
      return false;
    }

    if (filters.workType && !(runSummary.workItems ?? []).some((workItem) => workItem.workType === filters.workType)) {
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
 * @param {{ store: PlatformStore, schemaRegistry: any, actor: any, requestUrl: URL }} options
 * @returns {{ filters: Record<string, string>, projectsById: Map<string, any>, runSummaries: Map<string, { exportCount: number, latestEvalStatus: string, assignees: string[], openCommentCount: number, activeAssignmentCount: number, activeWorkItemCount: number, overdueWorkItemCount: number, threadCount: number, reviewAssignments: any[], workItems: any[] }>, workflowRuns: any[] }}
 */
function buildReviewDashboardContext(options) {
  const accessibleProjects = options.store.listProjects().filter((project) => canAccessTenant(options.actor, getTenantId(project)));
  const accessibleWorkflowRuns = options.store.listWorkflowRuns()
    .filter((workflowRun) => canAccessTenant(options.actor, getTenantId(workflowRun)));
  const tenantId = normalizeTenantId(options.actor.tenantId);
  escalateOverdueWorkItems(options.store, tenantId);
  const projectsById = new Map(accessibleProjects.map((project) => [project.id, project]));
  const syncedWorkflowRuns = accessibleWorkflowRuns.map((workflowRun) => (
    syncLatestEvalMetadata(options.store, options.schemaRegistry, workflowRun)
  ));
  const runSummaries = new Map(syncedWorkflowRuns.map((workflowRun) => [
    workflowRun.id,
    (() => {
      const reviewAssignments = listReviewAssignmentsForRun(options.store, workflowRun);
      const reviewComments = listReviewCommentsForRun(options.store, workflowRun);
      const workItems = listWorkItemsForRun(options.store, workflowRun);

      return {
        exportCount: options.store.listExportHistoryEntries(workflowRun.id).length,
        latestEvalStatus: getLatestEvalStatus(options.store, workflowRun),
        assignees: summarizeAssignmentDisplayNames(reviewAssignments),
        openCommentCount: countOpenReviewComments(reviewComments),
        activeAssignmentCount: reviewAssignments.filter((assignment) => isActiveReviewAssignment(assignment)).length,
        activeWorkItemCount: workItems.filter((workItem) => workItem.status === 'queued' || workItem.status === 'in-progress' || workItem.status === 'escalated').length,
        overdueWorkItemCount: workItems.filter((workItem) => isWorkItemOverdue(workItem)).length,
        threadCount: getThreadCount(options.store, workflowRun),
        reviewAssignments,
        workItems,
      };
    })(),
  ]));
  const filters = {
    disease: options.requestUrl.searchParams.get('disease') ?? '',
    state: options.requestUrl.searchParams.get('state') ?? '',
    stage: options.requestUrl.searchParams.get('stage') ?? '',
    assignee: options.requestUrl.searchParams.get('assignee') ?? '',
    exportStatus: options.requestUrl.searchParams.get('exportStatus') ?? '',
    evalStatus: options.requestUrl.searchParams.get('evalStatus') ?? '',
    queueStatus: options.requestUrl.searchParams.get('queueStatus') ?? '',
    workType: options.requestUrl.searchParams.get('workType') ?? '',
    sort: options.requestUrl.searchParams.get('sort') ?? 'updated-desc',
  };

  return {
    filters,
    projectsById,
    runSummaries,
    workflowRuns: filterAndSortWorkflowRuns(syncedWorkflowRuns, projectsById, runSummaries, filters),
  };
}

/**
 * @param {{ store: PlatformStore, schemaRegistry: any, clinicalService: any, actor: any, runId: string }} options
 * @returns {{ workflowRun: any, project: any, canonicalDisease: any, clinicalPackage: any, approvableRoles: string[], latestEvalRun: any | null, latestEvalStatus: string, exportHistory: any[], auditLogs: any[], artifactGroups: any[], reviewAssignments: any[], reviewComments: any[], workItems: any[], reviewThreads: any[], renderJobs: any[], renderingGuide: any | null }}
 */
function buildReviewRunContext(options) {
  let workflowRun = options.store.getWorkflowRun(options.runId);

  if (!workflowRun) {
    throw createHttpError(404, 'Workflow run not found.');
  }

  workflowRun = syncLatestEvalMetadata(options.store, options.schemaRegistry, workflowRun);
  escalateOverdueWorkItems(options.store, getTenantId(workflowRun));
  assertTenantAccess(options.actor, getTenantId(workflowRun), options.store, options.schemaRegistry, 'review.view', 'workflow-run', workflowRun.id);

  const project = getProjectForRun(options.store, workflowRun);
  const canonicalArtifactReference = findLatestArtifactReference(workflowRun, 'canonical-disease');
  const canonicalDisease = canonicalArtifactReference
    ? options.store.getArtifact('canonical-disease', canonicalArtifactReference.artifactId)
    : null;
  const clinicalPackage = loadClinicalPackageForRun({
    store: options.store,
    workflowRun,
    clinicalService: options.clinicalService,
  });
  const workItems = listWorkItemsForRun(options.store, workflowRun);
  const reviewThreads = listReviewThreadsForRun(options.store, workflowRun).map((reviewThread) => {
    const messages = listMessagesForThread(options.store, workflowRun.tenantId, reviewThread.id);
    const latestMessage = messages.at(-1) ?? null;
    const linkedWorkItemIds = workItems
      .filter((workItem) => (
        (reviewThread.scopeType === 'run' && workItem.workflowRunId === workflowRun.id)
        || (reviewThread.scopeId && workItem.subjectId === reviewThread.scopeId)
      ))
      .map((workItem) => workItem.id);

    return {
      ...reviewThread,
      messages,
      unreadCount: messages.filter((message) => message.status === 'posted').length,
      latestMessagePreview: latestMessage?.body?.slice(0, 160) ?? '',
      latestMessageAt: latestMessage?.updatedAt,
      openActionCount: linkedWorkItemIds.length,
      linkedWorkItemIds,
    };
  });

  return {
    workflowRun,
    project,
    canonicalDisease,
    clinicalPackage,
    approvableRoles: workflowRun.requiredApprovalRoles.filter(
      (/** @type {string} */ role) => canSubmitApproval(options.actor, role),
    ),
    reviewAssignments: listReviewAssignmentsForRun(options.store, workflowRun),
    reviewComments: listReviewCommentsForRun(options.store, workflowRun),
    workItems,
    reviewThreads,
    renderingGuide: loadLatestArtifact(options.store, workflowRun, 'rendering-guide'),
    renderJobs: listRenderJobsForRun(options.store, workflowRun),
    latestEvalRun: getLatestEvalRun(options.store, workflowRun),
    latestEvalStatus: getLatestEvalStatus(options.store, workflowRun),
    exportHistory: options.store.listExportHistoryEntries(workflowRun.id),
    auditLogs: options.store.listAuditLogEntries({ subjectId: workflowRun.id, subjectType: 'workflow-run' }),
    artifactGroups: buildReviewArtifactGroups(options.store, workflowRun),
  };
}

/**
 * @param {{ store: PlatformStore, workflowRun: any, artifactTypeFilters: string[], expand: boolean }} options
 * @returns {any}
 */
function buildWorkflowArtifactListViewPayload(options) {
  const filteredReferences = options.workflowRun.artifacts.filter((/** @type {any} */ artifactReference) => (
    options.artifactTypeFilters.length === 0 || options.artifactTypeFilters.includes(artifactReference.artifactType)
  ));

  return createWorkflowArtifactListView({
    runId: options.workflowRun.id,
    artifactTypeFilters: options.artifactTypeFilters,
    expand: options.expand,
    artifacts: filteredReferences.map((/** @type {any} */ artifactReference) => {
      const artifactMetadata = options.store.getArtifactMetadata(artifactReference.artifactType, artifactReference.artifactId);
      const artifactPayload = options.expand
        ? loadArtifactByReference(options.store, artifactReference)
        : undefined;

      return {
        artifactType: artifactReference.artifactType,
        artifactId: artifactReference.artifactId,
        status: artifactReference.status,
        path: artifactMetadata?.location ?? artifactReference.path,
        ...(artifactPayload ? { payload: artifactPayload } : {}),
      };
    }),
  });
}

/**
 * @param {{ store: PlatformStore, workflowRun: any }} options
 * @returns {any}
 */
function buildRenderingGuideViewPayload(options) {
  const guidePayload = loadRenderingGuidePayload({
    store: options.store,
    workflowRun: options.workflowRun,
  });

  if (!guidePayload) {
    throw createHttpError(404, 'No rendering guide is available for this workflow run yet.');
  }

  const renderedAssets = listTenantArtifactsByType(options.store, 'rendered-asset', options.workflowRun.tenantId)
    .filter((renderedAsset) => renderedAsset.workflowRunId === options.workflowRun.id);
  const latestRenderedAssetManifest = loadLatestArtifact(options.store, options.workflowRun, 'rendered-asset-manifest');
  const gateState = getRenderGuideGateState(options.store, options.workflowRun);

  return createRenderingGuideView({
    runId: options.workflowRun.id,
    renderingGuide: guidePayload.renderingGuide,
    markdown: guidePayload.markdown,
    attachmentSummary: {
      attachedRenderedAssetCount: renderedAssets.length,
      latestRenderedAssetManifestId: latestRenderedAssetManifest?.id,
      attachmentMode: renderedAssets.length > 0 ? 'external-art-attached' : 'guide-only',
    },
    visualReferencePack: gateState.visualReferencePack,
    reviewDecision: gateState.reviewDecision,
    gateStatus: gateState.status,
    renderDisabledReason: gateState.renderDisabledReason,
    guideWarnings: gateState.guideWarnings,
  });
}

/**
 * @param {string} value
 * @returns {string}
 */
function slugifyIdentifier(value) {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized || 'local-reviewer';
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function toStringArray(value) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === 'string' && item.trim().length > 0)
    : [];
}

/**
 * @param {unknown} value
 * @returns {string | undefined}
 */
function normalizeOptionalDateTime(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

/**
 * @param {PlatformStore} store
 * @param {any} workflowRun
 * @param {string} artifactType
 * @returns {Array<{ artifactId: string, createdAt: string, status: string, path?: string }>}
 */
function listArtifactHistoryForRun(store, workflowRun, artifactType) {
  return workflowRun.artifacts
    .map((/** @type {any} */ artifactReference, /** @type {number} */ index) => ({ artifactReference, index }))
    .filter((/** @type {{ artifactReference: any, index: number }} */ entry) => entry.artifactReference.artifactType === artifactType)
    .map((/** @type {{ artifactReference: any, index: number }} */ entry) => {
      const { artifactReference, index } = entry;
      const artifactMetadata = store.getArtifactMetadata(artifactReference.artifactType, artifactReference.artifactId);

      return {
        artifactType: artifactReference.artifactType,
        artifactId: artifactReference.artifactId,
        createdAt: artifactMetadata?.createdAt ?? workflowRun.updatedAt,
        status: artifactReference.status,
        path: artifactMetadata?.location ?? artifactReference.path,
        index,
      };
    })
    .sort((/** @type {any} */ left, /** @type {any} */ right) => right.createdAt.localeCompare(left.createdAt) || right.index - left.index);
}

/**
 * @param {{ store: PlatformStore, workflowRun: any, artifactType: string, leftArtifactId?: string | null, rightArtifactId?: string | null }} options
 * @returns {any}
 */
function buildArtifactDiffViewPayload(options) {
  const history = listArtifactHistoryForRun(options.store, options.workflowRun, options.artifactType);
  const availableArtifacts = history.map((entry) => ({
    artifactId: entry.artifactId,
    createdAt: entry.createdAt,
    status: entry.status,
    ...(entry.path ? { path: entry.path } : {}),
  }));

  if (history.length < 2) {
    return {
      schemaVersion: SCHEMA_VERSION,
      runId: options.workflowRun.id,
      artifactType: options.artifactType,
      comparisonStatus: 'insufficient-history',
      availableArtifacts,
      summary: {
        changeCount: 0,
        addedCount: 0,
        removedCount: 0,
        changedCount: 0,
      },
      changes: [],
    };
  }

  const rightEntry = options.rightArtifactId
    ? history.find((entry) => entry.artifactId === options.rightArtifactId)
    : history[0];
  const leftEntry = options.leftArtifactId
    ? history.find((entry) => entry.artifactId === options.leftArtifactId)
    : history.find((entry) => entry.artifactId !== rightEntry?.artifactId) ?? history[1];

  if (!leftEntry || !rightEntry) {
    throw createHttpError(404, `Unable to load artifact history for ${options.artifactType}.`);
  }

  const leftPayload = options.store.getArtifact(options.artifactType, leftEntry.artifactId);
  const rightPayload = options.store.getArtifact(options.artifactType, rightEntry.artifactId);

  if (!leftPayload || !rightPayload) {
    throw createHttpError(404, `Artifact versions for ${options.artifactType} could not be loaded.`);
  }

  const changes = diffJsonValues(leftPayload, rightPayload);

  return {
    schemaVersion: SCHEMA_VERSION,
    runId: options.workflowRun.id,
    artifactType: options.artifactType,
    comparisonStatus: 'diff-available',
    leftArtifactId: leftEntry.artifactId,
    rightArtifactId: rightEntry.artifactId,
    leftCreatedAt: leftEntry.createdAt,
    rightCreatedAt: rightEntry.createdAt,
    comparedAt: new Date().toISOString(),
    availableArtifacts,
    summary: summarizeJsonDiff(changes),
    changes,
  };
}

/**
 * @param {{ workflowRun: any, actor: any, payload: Record<string, unknown>, existingComment?: any | null }} options
 * @returns {any}
 */
function buildReviewCommentRecord(options) {
  const timestamp = new Date().toISOString();
  const scopeType = options.payload.scopeType === 'artifact' ? 'artifact' : (options.existingComment?.scopeType ?? 'run');
  let artifactType = typeof options.payload.artifactType === 'string'
    ? options.payload.artifactType
    : options.existingComment?.artifactType;
  let artifactId = typeof options.payload.artifactId === 'string'
    ? options.payload.artifactId
    : options.existingComment?.artifactId;

  if (scopeType === 'artifact') {
    if (!artifactType) {
      throw createHttpError(400, 'artifactType is required for artifact-scoped comments.');
    }

    if (!artifactId) {
      artifactId = findLatestArtifactReference(options.workflowRun, artifactType)?.artifactId;
    }

    if (!artifactId) {
      throw createHttpError(404, `No artifact version is available for ${artifactType}.`);
    }
  } else {
    artifactType = undefined;
    artifactId = undefined;
  }

  const body = typeof options.payload.body === 'string'
    ? options.payload.body.trim()
    : options.existingComment?.body;

  if (!body) {
    throw createHttpError(400, 'body is required for review comments.');
  }

  const status = typeof options.payload.status === 'string'
    ? options.payload.status
    : options.existingComment?.status ?? 'open';
  const severity = typeof options.payload.severity === 'string'
    ? options.payload.severity
    : options.existingComment?.severity ?? 'warning';

  if (!REVIEW_COMMENT_STATUSES.has(status)) {
    throw createHttpError(400, 'status must be one of open, resolved, or note.');
  }

  if (!REVIEW_COMMENT_SEVERITIES.has(severity)) {
    throw createHttpError(400, 'severity must be one of info, warning, or critical.');
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    id: options.existingComment?.id ?? createId('cmt'),
    tenantId: getTenantId(options.workflowRun),
    workflowRunId: options.workflowRun.id,
    scopeType,
    ...(artifactType ? { artifactType } : {}),
    ...(artifactId ? { artifactId } : {}),
    ...(typeof options.payload.fieldPath === 'string'
      ? { fieldPath: options.payload.fieldPath }
      : (options.existingComment?.fieldPath ? { fieldPath: options.existingComment.fieldPath } : {})),
    status,
    severity,
    body,
    reviewerId: options.actor.id,
    reviewerDisplayName: options.actor.displayName ?? options.actor.id,
    reviewerRoles: toStringArray(options.actor.roles).length > 0 ? toStringArray(options.actor.roles) : ['Local Operator'],
    tags: toStringArray(options.payload.tags).length > 0
      ? toStringArray(options.payload.tags)
      : (options.existingComment?.tags ?? []),
    ...(status === 'resolved'
      ? { resolvedAt: options.existingComment?.resolvedAt ?? timestamp }
      : {}),
    createdAt: options.existingComment?.createdAt ?? timestamp,
    updatedAt: timestamp,
    ...(isRecord(options.payload.metadata)
      ? { metadata: options.payload.metadata }
      : (options.existingComment?.metadata ? { metadata: options.existingComment.metadata } : {})),
  };
}

/**
 * @param {{ workflowRun: any, actor: any, payload: Record<string, unknown>, existingAssignment?: any | null }} options
 * @returns {any}
 */
function buildReviewAssignmentRecord(options) {
  const timestamp = new Date().toISOString();
  const assigneeDisplayName = typeof options.payload.assigneeDisplayName === 'string'
    ? options.payload.assigneeDisplayName.trim()
    : options.existingAssignment?.assigneeDisplayName;
  const reviewRole = typeof options.payload.reviewRole === 'string'
    ? options.payload.reviewRole
    : options.existingAssignment?.reviewRole;

  if (!assigneeDisplayName || !reviewRole) {
    throw createHttpError(400, 'reviewRole and assigneeDisplayName are required for review assignments.');
  }

  const status = typeof options.payload.status === 'string'
    ? options.payload.status
    : options.existingAssignment?.status ?? 'queued';
  const assigneeRoles = toStringArray(options.payload.assigneeRoles).length > 0
    ? toStringArray(options.payload.assigneeRoles)
    : (options.existingAssignment?.assigneeRoles ?? (toStringArray(options.actor.roles).length > 0 ? toStringArray(options.actor.roles) : ['Local Operator']));

  if (!REVIEW_ASSIGNMENT_STATUSES.has(status)) {
    throw createHttpError(400, 'status must be queued, in-progress, completed, or reassigned.');
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    id: options.existingAssignment?.id ?? createId('asg'),
    tenantId: getTenantId(options.workflowRun),
    workflowRunId: options.workflowRun.id,
    reviewRole,
    assigneeId: typeof options.payload.assigneeId === 'string'
      ? options.payload.assigneeId
      : (options.existingAssignment?.assigneeId ?? slugifyIdentifier(assigneeDisplayName)),
    assigneeDisplayName,
    assigneeRoles,
    status,
    ...(normalizeOptionalDateTime(options.payload.dueAt) ? { dueAt: normalizeOptionalDateTime(options.payload.dueAt) } : (options.existingAssignment?.dueAt ? { dueAt: options.existingAssignment.dueAt } : {})),
    ...(status === 'completed'
      ? { completedAt: normalizeOptionalDateTime(options.payload.completedAt) ?? options.existingAssignment?.completedAt ?? timestamp }
      : {}),
    ...(typeof options.payload.notes === 'string'
      ? { notes: options.payload.notes }
      : (options.existingAssignment?.notes ? { notes: options.existingAssignment.notes } : {})),
    assignedBy: options.existingAssignment?.assignedBy ?? options.actor.id,
    assignedByRoles: options.existingAssignment?.assignedByRoles ?? (toStringArray(options.actor.roles).length > 0 ? toStringArray(options.actor.roles) : ['Local Operator']),
    createdAt: options.existingAssignment?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
}

/**
 * @param {PlatformStore} store
 * @param {any} workflowRun
 * @param {string} scopeType
 * @param {string | undefined} scopeId
 * @returns {any | null}
 */
function findReviewThread(store, workflowRun, scopeType, scopeId = undefined) {
  return listReviewThreadsForRun(store, workflowRun).find((thread) => thread.scopeType === scopeType && thread.scopeId === scopeId) ?? null;
}

/**
 * @param {{ store: PlatformStore, schemaRegistry: any, workflowRun: any, actor: any, title: string, scopeType: string, scopeId?: string }} options
 * @returns {any}
 */
function ensureReviewThread(options) {
  const existingThread = findReviewThread(options.store, options.workflowRun, options.scopeType, options.scopeId);
  const reviewThread = buildReviewThread({
    tenantId: options.workflowRun.tenantId,
    workflowRunId: options.workflowRun.id,
    scopeType: options.scopeType,
    scopeId: options.scopeId,
    title: options.title,
    actor: options.actor,
    existingThread,
  });
  assertSchema(options.schemaRegistry, 'contracts/review-thread.schema.json', reviewThread);
  options.store.saveArtifact('review-thread', reviewThread.id, reviewThread, {
    tenantId: options.workflowRun.tenantId,
  });
  return reviewThread;
}

/**
 * @param {{ store: PlatformStore, schemaRegistry: any, workflowRun: any, thread: any, actor: any, body: string, parentMessageId?: string, mentions?: string[], mentionedActorIds?: string[], resolutionNote?: string }} options
 * @returns {any}
 */
function appendThreadMessage(options) {
  const reviewMessage = buildReviewMessage({
    tenantId: options.workflowRun.tenantId,
    workflowRunId: options.workflowRun.id,
    threadId: options.thread.id,
    body: options.body,
    actor: options.actor,
    parentMessageId: options.parentMessageId,
    mentions: options.mentions,
    mentionedActorIds: options.mentionedActorIds,
    resolutionNote: options.resolutionNote,
  });
  assertSchema(options.schemaRegistry, 'contracts/review-message.schema.json', reviewMessage);
  options.store.saveArtifact('review-message', reviewMessage.id, reviewMessage, {
    tenantId: options.workflowRun.tenantId,
  });

  if (options.resolutionNote) {
    const resolvedThread = {
      ...options.thread,
      status: 'resolved',
      resolvedAt: reviewMessage.resolvedAt ?? new Date().toISOString(),
      updatedAt: reviewMessage.updatedAt,
    };
    assertSchema(options.schemaRegistry, 'contracts/review-thread.schema.json', resolvedThread);
    options.store.saveArtifact('review-thread', resolvedThread.id, resolvedThread, {
      tenantId: options.workflowRun.tenantId,
    });
  }

  createMentionNotifications({
    store: options.store,
    schemaRegistry: options.schemaRegistry,
    workflowRun: options.workflowRun,
    actor: options.actor,
    threadId: options.thread.id,
    subjectType: options.thread.scopeType,
    subjectId: options.thread.scopeId ?? options.workflowRun.id,
    body: options.body,
    mentions: options.mentions,
    mentionedActorIds: options.mentionedActorIds,
  });
  return reviewMessage;
}

/**
 * @param {{ store: PlatformStore, schemaRegistry: any, workflowRun: any, reviewAssignment: any }} options
 * @returns {any}
 */
function syncAssignmentWorkItem(options) {
  const existingWorkItem = listWorkItemsForRun(options.store, options.workflowRun)
    .find((workItem) => workItem.originType === 'review-assignment' && workItem.originId === options.reviewAssignment.id)
    ?? null;
  const workItem = buildWorkItem({
    tenantId: options.workflowRun.tenantId,
    workflowRunId: options.workflowRun.id,
    workType: 'run-review',
    queueName: 'review-queue',
    subjectType: 'workflow-run',
    subjectId: options.workflowRun.id,
    reason: options.workflowRun.pauseReason ?? 'export-blocker',
    priority: options.reviewAssignment.reviewRole === 'clinical' ? 'high' : 'medium',
    assignedActorId: options.reviewAssignment.assigneeId,
    assignedActorDisplayName: options.reviewAssignment.assigneeDisplayName,
    assignedActorRoles: options.reviewAssignment.assigneeRoles,
    originType: 'review-assignment',
    originId: options.reviewAssignment.id,
    notes: typeof options.reviewAssignment.notes === 'string' ? [options.reviewAssignment.notes] : [],
    metadata: {
      reviewRole: options.reviewAssignment.reviewRole,
      assignmentStatus: options.reviewAssignment.status,
    },
    existingWorkItem,
  });

  if (options.reviewAssignment.status === 'completed') {
    workItem.status = 'completed';
    workItem.completedAt = options.reviewAssignment.completedAt ?? new Date().toISOString();
  } else if (options.reviewAssignment.status === 'in-progress') {
    workItem.status = 'in-progress';
  }

  assertSchema(options.schemaRegistry, 'contracts/work-item.schema.json', workItem);
  options.store.saveArtifact('work-item', workItem.id, workItem, {
    tenantId: options.workflowRun.tenantId,
  });
  return workItem;
}

/**
 * @param {{ store: PlatformStore, schemaRegistry: any, workflowRun: any, reviewComment: any, actor: any }} options
 * @returns {{ thread: any, message: any }}
 */
function syncCommentThread(options) {
  const threadTitle = options.reviewComment.scopeType === 'artifact'
    ? `${options.reviewComment.artifactType} discussion`
    : 'Run discussion';
  const reviewThread = ensureReviewThread({
    store: options.store,
    schemaRegistry: options.schemaRegistry,
    workflowRun: options.workflowRun,
    actor: options.actor,
    title: threadTitle,
    scopeType: options.reviewComment.scopeType === 'artifact' ? 'artifact' : 'run',
    scopeId: options.reviewComment.scopeType === 'artifact'
      ? `${options.reviewComment.artifactType}:${options.reviewComment.artifactId}`
      : undefined,
  });
  const reviewMessage = appendThreadMessage({
    store: options.store,
    schemaRegistry: options.schemaRegistry,
    workflowRun: options.workflowRun,
    thread: reviewThread,
    actor: options.actor,
    body: options.reviewComment.body,
    mentions: options.reviewComment.tags ?? [],
    resolutionNote: options.reviewComment.status === 'resolved' ? 'Review comment marked resolved.' : undefined,
  });

  return {
    thread: reviewThread,
    message: reviewMessage,
  };
}

/**
 * @param {PlatformStore} store
 * @param {any} workflowRun
 * @param {string} sourceId
 * @returns {any | null}
 */
function findExistingSourceRefreshTask(store, workflowRun, sourceId) {
  return listTenantArtifactsByType(store, 'source-refresh-task', workflowRun.tenantId)
    .find((task) => task.workflowRunId === workflowRun.id && task.sourceId === sourceId && task.status !== 'completed' && task.status !== 'cancelled')
    ?? null;
}

/**
 * @param {{ store: PlatformStore, schemaRegistry: any, workflowRun: any, actor: any, clinicalPackage: any }} options
 * @returns {void}
 */
function ensureClinicalGovernanceTasks(options) {
  for (const sourceRecord of options.clinicalPackage.sourceRecords ?? []) {
    const requiresRefresh = sourceRecord.freshnessState === 'stale'
      || sourceRecord.approvalStatus === 'suspended'
      || sourceRecord.contradictionStatus === 'blocking'
      || sourceRecord.contradictionStatus === 'monitor'
      || typeof sourceRecord.supersededBy === 'string'
      || !sourceRecord.primaryOwnerRole
      || !sourceRecord.backupOwnerRole;

    if (!requiresRefresh) {
      continue;
    }

    const existingTask = findExistingSourceRefreshTask(options.store, options.workflowRun, sourceRecord.id);
    saveSourceRefreshTask({
      store: options.store,
      schemaRegistry: options.schemaRegistry,
      actor: options.actor,
      tenantId: options.workflowRun.tenantId,
      workflowRunId: options.workflowRun.id,
      sourceRecord: {
        ...sourceRecord,
        freshnessState: sourceRecord.approvalStatus === 'suspended' ? 'blocked' : sourceRecord.freshnessState,
      },
      existingTask,
      reason: sourceRecord.approvalStatus === 'suspended'
        ? 'Source is suspended and blocks release.'
        : (typeof sourceRecord.supersededBy === 'string'
          ? `Source has been superseded by ${sourceRecord.supersededBy}.`
          : (!sourceRecord.primaryOwnerRole || !sourceRecord.backupOwnerRole
            ? 'Source ownership is incomplete.'
            : (sourceRecord.contradictionStatus === 'blocking' || sourceRecord.contradictionStatus === 'monitor'
              ? `Source has contradiction status ${sourceRecord.contradictionStatus}.`
              : `Source freshness state is ${sourceRecord.freshnessState}.`))),
    });
  }
}

/**
 * @param {PlatformStore} store
 * @param {any} clinicalService
 * @param {string} tenantId
 * @returns {Array<Record<string, any>>}
 */
function buildSourceCatalogPayload(store, clinicalService, tenantId) {
  const governanceDecisions = listTenantGovernanceArtifacts(store, tenantId, 'source-governance-decision');
  const contradictionResolutions = listTenantGovernanceArtifacts(store, tenantId, 'contradiction-resolution');
  const ownerAssignments = listTenantArtifactsByType(store, 'source-owner-assignment', tenantId);
  const sourceRefreshTasks = listTenantArtifactsByType(store, 'source-refresh-task', tenantId);
  const canonicalDiseases = [...new Set([
    ...Object.values(clinicalService.library ?? {}).map((knowledgePack) => knowledgePack.canonicalDiseaseName),
    ...store.listWorkflowRuns()
      .filter((workflowRun) => getTenantId(workflowRun) === tenantId)
      .map((workflowRun) => loadResolvedCanonicalDiseaseForRun(store, workflowRun)?.canonicalDiseaseName)
      .filter(Boolean),
  ])];
  /** @type {Map<string, any>} */
  const mergedRecords = new Map();

  for (const canonicalDiseaseName of canonicalDiseases) {
    const sourceRecords = clinicalService.listSourceRecords(canonicalDiseaseName, {
      governanceDecisions,
      contradictionResolutions,
    });

    for (const sourceRecord of sourceRecords) {
      const existing = mergedRecords.get(sourceRecord.id);
      const ownerAssignment = ownerAssignments
        .filter((assignment) => assignment.sourceId === sourceRecord.id)
        .sort((left, right) => String(right.assignedAt).localeCompare(String(left.assignedAt)))
        .at(0);
      const impactedRunCount = store.listWorkflowRuns().filter((workflowRun) => {
        if (getTenantId(workflowRun) !== tenantId) {
          return false;
        }

        const diseasePacket = loadLatestArtifact(store, workflowRun, 'disease-packet');
        return diseasePacket?.evidence?.some((/** @type {any} */ record) => record.sourceId === sourceRecord.id);
      }).length;

      mergedRecords.set(sourceRecord.id, {
        ...sourceRecord,
        primaryOwnerRole: ownerAssignment?.primaryOwnerRole ?? sourceRecord.primaryOwnerRole,
        backupOwnerRole: ownerAssignment?.backupOwnerRole ?? sourceRecord.backupOwnerRole,
        impactedDiseaseCount: existing ? existing.impactedDiseaseCount + 1 : 1,
        impactedRunCount,
        openRefreshTaskCount: sourceRefreshTasks.filter((task) => task.sourceId === sourceRecord.id && task.status === 'open').length,
      });
    }
  }

  return [...mergedRecords.values()].sort((/** @type {any} */ left, /** @type {any} */ right) => String(left.sourceLabel).localeCompare(String(right.sourceLabel)));
}

/**
 * @param {{ store: PlatformStore, clinicalService: any, tenantId: string, searchParams?: URLSearchParams }} options
 * @returns {any}
 */
function buildSourceOpsView(options) {
  const filters = {
    disease: options.searchParams?.get('disease') ?? '',
    freshnessState: options.searchParams?.get('freshnessState') ?? '',
    approvalStatus: options.searchParams?.get('approvalStatus') ?? '',
    ownerRole: options.searchParams?.get('ownerRole') ?? '',
    openRefreshOnly: options.searchParams?.get('openRefreshOnly') === 'true',
  };
  const allSourceRecords = buildSourceCatalogPayload(options.store, options.clinicalService, options.tenantId);
  const refreshTasks = listTenantArtifactsByType(options.store, 'source-refresh-task', options.tenantId);
  const workItems = listTenantArtifactsByType(options.store, 'work-item', options.tenantId)
    .filter((workItem) => workItem.workType === 'source-refresh');
  const sourceHasOpenRefresh = new Set(refreshTasks
    .filter((task) => task.status !== 'completed' && task.status !== 'cancelled')
    .map((task) => task.sourceId));
  const visibleSourceRecords = allSourceRecords.filter((sourceRecord) => {
    if (filters.disease && String(sourceRecord.canonicalDiseaseName ?? '').toLowerCase() !== filters.disease.toLowerCase()) {
      return false;
    }

    if (filters.freshnessState && sourceRecord.freshnessState !== filters.freshnessState) {
      return false;
    }

    if (filters.approvalStatus && sourceRecord.approvalStatus !== filters.approvalStatus) {
      return false;
    }

    if (filters.ownerRole) {
      const ownerNeedle = filters.ownerRole.toLowerCase();
      const primaryOwnerRole = String(sourceRecord.primaryOwnerRole ?? '').toLowerCase();
      const backupOwnerRole = String(sourceRecord.backupOwnerRole ?? '').toLowerCase();

      if (!primaryOwnerRole.includes(ownerNeedle) && !backupOwnerRole.includes(ownerNeedle)) {
        return false;
      }
    }

    if (filters.openRefreshOnly && !sourceHasOpenRefresh.has(sourceRecord.id)) {
      return false;
    }

    return true;
  });
  const visibleSourceIds = new Set(visibleSourceRecords.map((sourceRecord) => sourceRecord.id));
  const visibleRefreshTasks = refreshTasks.filter((task) => visibleSourceIds.has(task.sourceId));
  const visibleWorkItems = workItems.filter((workItem) => visibleSourceIds.has(workItem.subjectId));

  return {
    schemaVersion: SCHEMA_VERSION,
    filters,
    summary: {
      visibleSourceCount: visibleSourceRecords.length,
      staleSourceCount: visibleSourceRecords.filter((sourceRecord) => sourceRecord.freshnessState === 'stale').length,
      blockedSourceCount: visibleSourceRecords.filter((sourceRecord) => sourceRecord.freshnessState === 'blocked' || sourceRecord.contradictionStatus === 'blocking').length,
      suspendedSourceCount: visibleSourceRecords.filter((sourceRecord) => sourceRecord.approvalStatus === 'suspended').length,
      ownerlessSourceCount: visibleSourceRecords.filter((sourceRecord) => !sourceRecord.primaryOwnerRole || !sourceRecord.backupOwnerRole).length,
      openRefreshTaskCount: visibleRefreshTasks.filter((task) => task.status !== 'completed' && task.status !== 'cancelled').length,
      impactedRunCount: visibleSourceRecords.reduce((total, sourceRecord) => total + Number(sourceRecord.impactedRunCount ?? 0), 0),
      promotedDiseaseCount: new Set(Object.values(options.clinicalService.library ?? {})
        .filter((knowledgePack) => knowledgePack.packStatus === 'promoted')
        .map((knowledgePack) => knowledgePack.canonicalDiseaseName)).size,
    },
    sourceRecords: visibleSourceRecords,
    refreshTasks: visibleRefreshTasks,
    workItems: visibleWorkItems,
  };
}

/**
 * @param {{ store: PlatformStore, clinicalService: any, tenantId: string }} options
 * @returns {any}
 */
function buildSourceRefreshCalendar(options) {
  const generatedAt = new Date().toISOString();
  const allSourceRecords = buildSourceCatalogPayload(options.store, options.clinicalService, options.tenantId);
  const workItems = listTenantArtifactsByType(options.store, 'work-item', options.tenantId)
    .filter((workItem) => workItem.workType === 'source-refresh' && workItem.status !== 'completed' && workItem.status !== 'cancelled');
  const referenceTime = new Date(generatedAt).getTime();
  const items = allSourceRecords.map((sourceRecord) => {
    const nextReviewDueAt = sourceRecord.nextReviewDueAt ?? generatedAt;
    const daysUntilDue = Math.ceil((new Date(nextReviewDueAt).getTime() - referenceTime) / (1000 * 60 * 60 * 24));
    const openRefreshWorkItemIds = workItems
      .filter((workItem) => workItem.subjectId === sourceRecord.id)
      .map((workItem) => workItem.id);
    const ownerless = !sourceRecord.primaryOwnerRole || !sourceRecord.backupOwnerRole;
    const bucket = ownerless
      ? 'ownerless'
      : (sourceRecord.freshnessState === 'blocked' || sourceRecord.approvalStatus === 'suspended'
        ? 'blocked'
        : (daysUntilDue < 0
          ? 'overdue'
          : (daysUntilDue <= 30
            ? 'due-30-days'
            : (daysUntilDue <= 90 ? 'due-90-days' : 'future'))));

    return {
      sourceId: sourceRecord.id,
      sourceLabel: sourceRecord.sourceLabel,
      canonicalDiseaseName: sourceRecord.canonicalDiseaseName,
      primaryOwnerRole: sourceRecord.primaryOwnerRole ?? '',
      backupOwnerRole: sourceRecord.backupOwnerRole ?? '',
      freshnessState: sourceRecord.freshnessState,
      nextReviewDueAt,
      daysUntilDue,
      bucket,
      openRefreshWorkItemIds,
    };
  }).sort((left, right) => left.daysUntilDue - right.daysUntilDue || left.canonicalDiseaseName.localeCompare(right.canonicalDiseaseName));

  return {
    schemaVersion: SCHEMA_VERSION,
    tenantId: options.tenantId,
    generatedAt,
    summary: {
      totalSourceCount: items.length,
      dueSoonCount: items.filter((item) => item.bucket === 'due-30-days' || item.bucket === 'due-90-days').length,
      overdueCount: items.filter((item) => item.bucket === 'overdue').length,
      ownerlessCount: items.filter((item) => item.bucket === 'ownerless').length,
      openRefreshWorkCount: items.reduce((total, item) => total + item.openRefreshWorkItemIds.length, 0),
    },
    items,
  };
}

/**
 * @param {{ store: PlatformStore, schemaRegistry: any, clinicalService: any, actor: any, rootDir: string }} options
 * @returns {{ workItems: any[], thread: any, message: any, notifications: any[], scenarioCases: any[] }}
 */
function createQueueProofScenario(options) {
  const workflowRun = options.store.listWorkflowRuns()
    .find((candidate) => getTenantId(candidate) === options.actor.tenantId);

  if (!workflowRun) {
    throw createHttpError(409, 'Create at least one workflow run before seeding a queue proof scenario.');
  }

  const clinicalPackage = loadClinicalPackageForRun({
    store: options.store,
    workflowRun,
    clinicalService: options.clinicalService,
  });
  const sourceRecord = clinicalPackage?.sourceRecords?.[0] ?? {
    id: `source.${workflowRun.id}`,
    sourceLabel: 'Run source placeholder',
    canonicalDiseaseName: workflowRun.input?.diseaseName ?? 'Unknown disease',
    freshnessState: 'aging',
  };
  const evidenceRecord = clinicalPackage?.evidenceRecords?.[0] ?? {
    claimId: `claim.${workflowRun.id}`,
  };
  const proofScenarioManifest = loadPilotProofScenarioManifest(options.rootDir);
  const proofItems = proofScenarioManifest.scenarios.map((scenario) => ({
    ...scenario,
    subjectId: scenario.subjectType === 'source-record'
      ? sourceRecord.id
      : (scenario.subjectType === 'evidence-record' ? evidenceRecord.claimId : workflowRun.id),
    notes: Array.isArray(scenario.notes)
      ? scenario.notes
      : [`Proof scenario: ${scenario.label ?? scenario.id}.`],
  }));
  const workItems = proofItems.map((item) => {
    const workItem = buildWorkItem({
      tenantId: workflowRun.tenantId,
      workflowRunId: workflowRun.id,
      assignedActorId: options.actor.id,
      assignedActorDisplayName: options.actor.displayName,
      assignedActorRoles: options.actor.roles,
      metadata: {
        canonicalDiseaseName: clinicalPackage?.diseasePacket?.canonicalDiseaseName ?? workflowRun.input?.diseaseName,
        proofScenario: true,
        proofScenarioId: item.id,
        proofScenarioLabel: item.label,
      },
      ...item,
    });
    assertSchema(options.schemaRegistry, 'contracts/work-item.schema.json', workItem);
    options.store.saveArtifact('work-item', workItem.id, workItem, {
      tenantId: workflowRun.tenantId,
    });
    return workItem;
  });
  const thread = buildReviewThread({
    tenantId: workflowRun.tenantId,
    workflowRunId: workflowRun.id,
    scopeType: 'run',
    scopeId: workflowRun.id,
    title: 'Local queue proof thread',
    actor: options.actor,
  });
  assertSchema(options.schemaRegistry, 'contracts/review-thread.schema.json', thread);
  options.store.saveArtifact('review-thread', thread.id, thread, {
    tenantId: workflowRun.tenantId,
  });
  const message = buildReviewMessage({
    tenantId: workflowRun.tenantId,
    workflowRunId: workflowRun.id,
    threadId: thread.id,
    body: '@local-operator Queue proof scenario seeded: promoted-pack review, provisional-pack promotion, source refresh, render retry, and local ops drill work are now visible.',
    actor: options.actor,
    mentions: ['local-operator'],
  });
  assertSchema(options.schemaRegistry, 'contracts/review-message.schema.json', message);
  options.store.saveArtifact('review-message', message.id, message, {
    tenantId: workflowRun.tenantId,
  });
  const notifications = createMentionNotifications({
    store: options.store,
    schemaRegistry: options.schemaRegistry,
    workflowRun,
    actor: options.actor,
    threadId: thread.id,
    workItemId: workItems[0]?.id,
    subjectType: 'workflow-run',
    subjectId: workflowRun.id,
    body: message.body,
    mentions: ['local-operator'],
  });
  appendAuditLog(
    options.store,
    options.schemaRegistry,
    options.actor,
    'review-queue.proof-scenario',
    'workflow-run',
    workflowRun.id,
    'success',
    'Seeded local queue proof scenario.',
    {
      workItemIds: workItems.map((workItem) => workItem.id),
      threadId: thread.id,
      messageId: message.id,
    },
  );

  return {
    workItems,
    thread,
    message,
    notifications,
    scenarioCases: proofScenarioManifest.scenarios,
  };
}

/**
 * @param {{ store: PlatformStore, rootDir: string, tenantId: string }} options
 * @returns {Promise<any>}
 */
async function buildLocalOpsStatus(options) {
  const backupRootDir = resolveLocalOpsDirectory(options.rootDir, options.store, 'backups', 'LOCAL_BACKUP_DIR');
  const deliveryRootDir = resolveLocalOpsDirectory(options.rootDir, options.store, 'delivery', 'LOCAL_DELIVERY_DIR');
  const storageStats = await collectDirectoryStats(options.store.objectStoreDir);

  return {
    schemaVersion: SCHEMA_VERSION,
    tenantId: options.tenantId,
    storage: {
      mode: 'local-only',
      dbFilePath: options.store.dbFilePath,
      objectStoreDir: options.store.objectStoreDir,
      backupRootDir,
      deliveryRootDir,
      objectCount: storageStats.objectCount,
      byteLength: storageStats.byteLength,
    },
    latestBackup: await getLatestDirectoryEntry(backupRootDir),
    latestRestoreSmoke: getLatestTenantArtifact(options.store, options.tenantId, 'restore-smoke-result'),
    latestDeliveryMirror: getLatestTenantArtifact(options.store, options.tenantId, 'local-delivery-mirror'),
    latestDeliveryVerification: getLatestTenantArtifact(options.store, options.tenantId, 'local-delivery-verification'),
    opsDrillWorkItems: listTenantArtifactsByType(options.store, 'work-item', options.tenantId)
      .filter((workItem) => workItem.workType === 'ops-drill'),
    generatedAt: new Date().toISOString(),
  };
}

/**
 * @param {{ store: PlatformStore, schemaRegistry: any, actor: any, rootDir: string }} options
 * @returns {Promise<any>}
 */
async function runLocalRestoreSmoke(options) {
  const startedAt = new Date().toISOString();
  const slug = timestampPathSegment(startedAt);
  const backupRootDir = resolveLocalOpsDirectory(options.rootDir, options.store, 'backups', 'LOCAL_BACKUP_DIR');
  const opsRootDir = resolveLocalOpsDirectory(options.rootDir, options.store, 'ops', 'LOCAL_OPS_DIR');
  const backupDir = path.join(backupRootDir, `restore-smoke-${slug}`);
  const scratchDir = path.join(opsRootDir, 'restore-smoke', `restore-smoke-${slug}`);
  const checks = [];

  await rm(scratchDir, {
    recursive: true,
    force: true,
  });
  await mkdir(path.join(backupDir, 'db'), {
    recursive: true,
  });
  await mkdir(scratchDir, {
    recursive: true,
  });

  let dbFileCopied = false;

  if (await pathExists(options.store.dbFilePath)) {
    await cp(options.store.dbFilePath, path.join(backupDir, 'db', path.basename(options.store.dbFilePath)));
    dbFileCopied = true;
    checks.push({
      name: 'sqlite-backup-copy',
      status: 'passed',
      details: `Copied ${options.store.dbFilePath}.`,
    });
  } else {
    checks.push({
      name: 'sqlite-backup-copy',
      status: 'failed',
      details: `SQLite database was not found at ${options.store.dbFilePath}.`,
    });
  }

  for (const suffix of ['-wal', '-shm']) {
    const sidecarPath = `${options.store.dbFilePath}${suffix}`;

    if (await pathExists(sidecarPath)) {
      await cp(sidecarPath, path.join(backupDir, 'db', path.basename(sidecarPath)));
    }
  }

  if (await pathExists(options.store.objectStoreDir)) {
    await cp(options.store.objectStoreDir, path.join(backupDir, 'object-store'), {
      recursive: true,
    });
    checks.push({
      name: 'object-store-backup-copy',
      status: 'passed',
      details: `Copied object store ${options.store.objectStoreDir}.`,
    });
  } else {
    checks.push({
      name: 'object-store-backup-copy',
      status: 'warning',
      details: 'Object store directory does not exist yet.',
    });
  }

  await cp(backupDir, scratchDir, {
    recursive: true,
  });
  checks.push({
    name: 'scratch-restore-copy',
    status: 'passed',
    details: `Restored backup snapshot into ${scratchDir}.`,
  });

  const restoredDbPath = path.join(scratchDir, 'db', path.basename(options.store.dbFilePath));

  checks.push({
    name: 'restored-sqlite-present',
    status: await pathExists(restoredDbPath) ? 'passed' : 'failed',
    details: restoredDbPath,
  });

  const restoredStats = await collectDirectoryStats(path.join(scratchDir, 'object-store'));
  const releaseBundleCount = options.store.listArtifactsByType('release-bundle', { tenantId: options.actor.tenantId }).length;
  const renderedManifestCount = options.store.listArtifactsByType('rendered-asset-manifest', { tenantId: options.actor.tenantId }).length;
  const artifactRows = options.store.db.prepare(`
    SELECT artifact_type, artifact_id, location
    FROM artifacts
    WHERE tenant_id = ?
  `).all(options.actor.tenantId);
  let schemaValidatedArtifactCount = 0;
  let schemaValidationFailureCount = 0;
  let objectReferenceCount = 0;
  let missingObjectReferenceCount = 0;

  for (const row of artifactRows) {
    const artifactType = String(row.artifact_type);
    const artifactId = String(row.artifact_id);
    const location = String(row.location);
    objectReferenceCount += 1;

    if (!(await pathExists(path.join(scratchDir, 'object-store', location)))) {
      missingObjectReferenceCount += 1;
    }

    const schemaId = `contracts/${artifactType}.schema.json`;

    if (!options.schemaRegistry.schemaIds.includes(schemaId)) {
      continue;
    }

    const artifact = options.store.getArtifact(artifactType, artifactId);
    const validationResult = options.schemaRegistry.validateBySchemaId(schemaId, artifact);

    if (validationResult.valid) {
      schemaValidatedArtifactCount += 1;
    } else {
      schemaValidationFailureCount += 1;
    }
  }

  checks.push({
    name: 'restored-object-references-present',
    status: missingObjectReferenceCount === 0 ? 'passed' : 'failed',
    details: `${objectReferenceCount - missingObjectReferenceCount}/${objectReferenceCount} artifact object references resolved in scratch restore.`,
  });
  checks.push({
    name: 'stored-artifact-schema-validation',
    status: schemaValidationFailureCount === 0 ? 'passed' : 'failed',
    details: `${schemaValidatedArtifactCount} artifacts validated against registered contracts; ${schemaValidationFailureCount} failed.`,
  });

  const deliveryMirrors = listTenantArtifactsByType(options.store, 'local-delivery-mirror', options.actor.tenantId);
  const deliveryVerifications = listTenantArtifactsByType(options.store, 'local-delivery-verification', options.actor.tenantId);
  const failedDeliveryVerificationCount = deliveryVerifications.filter((verification) => verification.status === 'failed').length;
  const unverifiedMirrorCount = deliveryMirrors.filter((mirror) => (
    !deliveryVerifications.some((verification) => verification.localDeliveryMirrorId === mirror.id && verification.status === 'passed')
  )).length;

  checks.push({
    name: 'delivery-mirror-verification',
    status: unverifiedMirrorCount === 0 && failedDeliveryVerificationCount === 0 ? 'passed' : 'warning',
    details: `${deliveryVerifications.length} delivery verifications recorded; ${unverifiedMirrorCount} mirrors lack a passing verification.`,
  });

  const completedAt = new Date().toISOString();
  const status = checks.some((check) => check.status === 'failed') ? 'failed' : 'passed';
  const restoreSmokeResult = {
    schemaVersion: SCHEMA_VERSION,
    id: createId('rsm'),
    tenantId: options.actor.tenantId,
    status,
    mode: 'local-filesystem',
    backupDir,
    scratchDir,
    checks,
    stats: {
      dbFileCopied,
      objectCount: restoredStats.objectCount,
      byteLength: restoredStats.byteLength,
      releaseBundleCount,
      renderedManifestCount,
      schemaValidatedArtifactCount,
      schemaValidationFailureCount,
      objectReferenceCount,
      missingObjectReferenceCount,
      deliveryVerificationCount: deliveryVerifications.length,
      failedDeliveryVerificationCount,
    },
    createdBy: options.actor.id,
    startedAt,
    completedAt,
  };
  assertSchema(options.schemaRegistry, 'contracts/restore-smoke-result.schema.json', restoreSmokeResult);
  options.store.saveArtifact('restore-smoke-result', restoreSmokeResult.id, restoreSmokeResult, {
    tenantId: options.actor.tenantId,
    retentionClass: 'audit-log',
  });

  const workItem = {
    ...buildWorkItem({
      tenantId: options.actor.tenantId,
      workType: 'ops-drill',
      queueName: 'local-ops',
      subjectType: 'restore-smoke-result',
      subjectId: restoreSmokeResult.id,
      reason: 'default',
      priority: status === 'passed' ? 'medium' : 'high',
      assignedActorId: options.actor.id,
      assignedActorDisplayName: options.actor.displayName,
      assignedActorRoles: options.actor.roles,
      originType: 'restore-smoke-result',
      originId: restoreSmokeResult.id,
      notes: [`Local restore smoke ${status}. Backup: ${backupDir}. Scratch: ${scratchDir}.`],
    }),
    status: status === 'passed' ? 'completed' : 'queued',
    completedAt: status === 'passed' ? completedAt : undefined,
    updatedAt: completedAt,
  };
  assertSchema(options.schemaRegistry, 'contracts/work-item.schema.json', workItem);
  options.store.saveArtifact('work-item', workItem.id, workItem, {
    tenantId: options.actor.tenantId,
  });

  appendAuditLog(
    options.store,
    options.schemaRegistry,
    options.actor,
    'local-ops.restore-smoke',
    'restore-smoke-result',
    restoreSmokeResult.id,
    status === 'passed' ? 'success' : 'error',
    `Local restore smoke ${status}.`,
    {
      backupDir,
      scratchDir,
      workItemId: workItem.id,
    },
  );

  return restoreSmokeResult;
}

/**
 * @param {{ store: PlatformStore, schemaRegistry: any, actor: any, releaseBundle: any, rootDir: string }} options
 * @returns {Promise<any>}
 */
async function mirrorReleaseBundleLocally(options) {
  const createdAt = new Date().toISOString();
  const deliveryRootDir = resolveLocalOpsDirectory(options.rootDir, options.store, 'delivery', 'LOCAL_DELIVERY_DIR');
  const deliveryDir = path.join(deliveryRootDir, safePathSegment(options.releaseBundle.releaseId));
  /** @type {Array<{ label: string, path: string, checksum: string, byteLength: number }>} */
  const files = [];
  /** @type {string[]} */
  const warnings = [];

  await rm(deliveryDir, {
    recursive: true,
    force: true,
  });
  await mkdir(deliveryDir, {
    recursive: true,
  });

  /**
   * @param {string} label
   * @param {string} relativeTargetPath
   * @param {string} contents
   * @returns {Promise<void>}
   */
  const addTextFile = async (label, relativeTargetPath, contents) => {
    const targetPath = path.join(deliveryDir, relativeTargetPath);
    await mkdir(path.dirname(targetPath), {
      recursive: true,
    });
    await writeFile(targetPath, contents);
    files.push({
      label,
      path: targetPath,
      checksum: sha256Hex(contents),
      byteLength: Buffer.byteLength(contents),
    });
  };
  /**
   * @param {string} label
   * @param {string} location
   * @param {string} relativeTargetPath
   * @returns {Promise<void>}
   */
  const addObjectFile = async (label, location, relativeTargetPath) => {
    const sourcePath = path.join(options.store.objectStoreDir, location);

    if (!(await pathExists(sourcePath))) {
      warnings.push(`Missing ${label} source object at ${location}.`);
      return;
    }

    const targetPath = path.join(deliveryDir, relativeTargetPath);
    const copied = await copyFileWithChecksum(sourcePath, targetPath);
    files.push({
      label,
      path: targetPath,
      checksum: copied.checksum,
      byteLength: copied.byteLength,
    });
  };

  await addTextFile('release-bundle', 'release-bundle.json', JSON.stringify(options.releaseBundle, null, 2));

  const bundleIndex = options.store.getDocument('release-index', options.releaseBundle.releaseId);

  if (bundleIndex) {
    await addTextFile('bundle-index', 'bundle-index.md', bundleIndex);
  } else {
    warnings.push('Release bundle index document was not found.');
  }

  const sourceEvidencePack = options.store.getDocument('source-evidence-pack', options.releaseBundle.releaseId);

  if (sourceEvidencePack) {
    await addTextFile('source-evidence-pack', 'source-evidence-pack.json', sourceEvidencePack);
  } else {
    warnings.push('Source evidence pack document was not found.');
  }

  if (options.releaseBundle.renderingGuideMarkdownDocumentId) {
    const renderingGuideMarkdown = options.store.getDocument('rendering-guide-markdown', options.releaseBundle.renderingGuideMarkdownDocumentId);

    if (renderingGuideMarkdown) {
      await addTextFile('rendering-guide', 'rendering-guide.md', renderingGuideMarkdown);
    } else {
      warnings.push('Rendering guide markdown document was not found.');
    }
  }

  for (const artifact of options.releaseBundle.artifactManifest ?? []) {
    if (artifact.location) {
      await addObjectFile(
        `artifact:${artifact.artifactType}`,
        artifact.location,
        path.join('artifacts', `${safePathSegment(artifact.artifactType)}-${safePathSegment(artifact.artifactId)}.json`),
      );
    }
  }

  const renderedManifest = options.releaseBundle.renderedAssetManifestId
    ? options.store.getArtifact('rendered-asset-manifest', options.releaseBundle.renderedAssetManifestId)
    : null;

  if (renderedManifest) {
    for (const renderedAsset of renderedManifest.renderedAssets ?? []) {
      if (renderedAsset.location) {
        await addObjectFile(
          `rendered-panel:${renderedAsset.panelId ?? renderedAsset.id}`,
          renderedAsset.location,
          path.join('rendered-panels', path.basename(renderedAsset.location)),
        );
      }
    }
  }

  const checksums = {
    schemaVersion: SCHEMA_VERSION,
    releaseId: options.releaseBundle.releaseId,
    generatedAt: createdAt,
    files: files.map((file) => ({
      label: file.label,
      path: path.relative(deliveryDir, file.path),
      checksum: file.checksum,
      byteLength: file.byteLength,
    })),
  };
  const checksumManifestPath = path.join(deliveryDir, 'checksums.json');
  await writeFile(checksumManifestPath, JSON.stringify(checksums, null, 2));
  const checksumManifestContents = await readFile(checksumManifestPath);
  files.push({
    label: 'checksums',
    path: checksumManifestPath,
    checksum: createHash('sha256').update(checksumManifestContents).digest('hex'),
    byteLength: checksumManifestContents.byteLength,
  });

  const deliveryMirror = {
    schemaVersion: SCHEMA_VERSION,
    id: createId('ldm'),
    tenantId: options.releaseBundle.tenantId,
    releaseId: options.releaseBundle.releaseId,
    workflowRunId: options.releaseBundle.workflowRunId,
    status: warnings.length === 0 ? 'mirrored' : 'partial',
    deliveryDir,
    files,
    ...(warnings.length > 0 ? { warnings } : {}),
    checksumManifestLocation: checksumManifestPath,
    createdBy: options.actor.id,
    createdAt,
  };
  assertSchema(options.schemaRegistry, 'contracts/local-delivery-mirror.schema.json', deliveryMirror);
  options.store.saveArtifact('local-delivery-mirror', deliveryMirror.id, deliveryMirror, {
    tenantId: deliveryMirror.tenantId,
    retentionClass: 'release-bundle',
  });
  appendAuditLog(
    options.store,
    options.schemaRegistry,
    options.actor,
    'release-bundle.mirror-local',
    'release-bundle',
    options.releaseBundle.releaseId,
    'success',
    `Mirrored release bundle ${options.releaseBundle.releaseId} to local delivery directory.`,
    {
      deliveryDir,
      deliveryMirrorId: deliveryMirror.id,
      warningCount: warnings.length,
    },
  );

  return deliveryMirror;
}

/**
 * @param {{ store: PlatformStore, schemaRegistry: any, actor: any, releaseBundle: any }} options
 * @returns {Promise<any>}
 */
async function verifyLocalDeliveryMirror(options) {
  const createdAt = new Date().toISOString();
  const deliveryMirror = listTenantArtifactsByType(options.store, 'local-delivery-mirror', options.releaseBundle.tenantId)
    .filter((candidate) => candidate.releaseId === options.releaseBundle.releaseId)
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
    .at(0);

  if (!deliveryMirror) {
    throw createHttpError(409, 'Release bundle has not been mirrored locally yet.');
  }

  /** @type {Array<{ name: string, status: 'passed' | 'failed' | 'warning', details?: string }>} */
  const checks = [];
  let verifiedFileCount = 0;
  let failedFileCount = 0;

  for (const file of deliveryMirror.files ?? []) {
    if (!(await pathExists(file.path))) {
      failedFileCount += 1;
      checks.push({
        name: file.label,
        status: 'failed',
        details: `Missing mirrored file at ${file.path}.`,
      });
      continue;
    }

    const contents = await readFile(file.path);
    const checksum = sha256Buffer(contents);

    if (checksum === file.checksum) {
      verifiedFileCount += 1;
      checks.push({
        name: file.label,
        status: 'passed',
        details: 'Checksum matched.',
      });
      continue;
    }

    failedFileCount += 1;
    checks.push({
      name: file.label,
      status: 'failed',
      details: `Checksum mismatch. Expected ${file.checksum}, received ${checksum}.`,
    });
  }

  if (await pathExists(deliveryMirror.checksumManifestLocation)) {
    checks.push({
      name: 'checksum-manifest-present',
      status: 'passed',
      details: deliveryMirror.checksumManifestLocation,
    });
  } else {
    failedFileCount += 1;
    checks.push({
      name: 'checksum-manifest-present',
      status: 'failed',
      details: `Missing checksum manifest at ${deliveryMirror.checksumManifestLocation}.`,
    });
  }

  const deliveryVerification = {
    schemaVersion: SCHEMA_VERSION,
    id: createId('ldv'),
    tenantId: deliveryMirror.tenantId,
    releaseId: deliveryMirror.releaseId,
    workflowRunId: deliveryMirror.workflowRunId,
    localDeliveryMirrorId: deliveryMirror.id,
    status: failedFileCount === 0 ? 'passed' : 'failed',
    deliveryDir: deliveryMirror.deliveryDir,
    checks,
    verifiedFileCount,
    failedFileCount,
    checksumManifestLocation: deliveryMirror.checksumManifestLocation,
    createdBy: options.actor.id,
    createdAt,
  };
  assertSchema(options.schemaRegistry, 'contracts/local-delivery-verification.schema.json', deliveryVerification);
  options.store.saveArtifact('local-delivery-verification', deliveryVerification.id, deliveryVerification, {
    tenantId: deliveryVerification.tenantId,
    retentionClass: 'release-bundle',
  });
  appendAuditLog(
    options.store,
    options.schemaRegistry,
    options.actor,
    'release-bundle.verify-local-mirror',
    'release-bundle',
    options.releaseBundle.releaseId,
    deliveryVerification.status === 'passed' ? 'success' : 'error',
    `Local delivery mirror verification ${deliveryVerification.status}.`,
    {
      deliveryVerificationId: deliveryVerification.id,
      localDeliveryMirrorId: deliveryMirror.id,
      failedFileCount,
    },
  );

  return deliveryVerification;
}

/**
 * @param {{ store: PlatformStore, schemaRegistry: any, actor: any, renderedAssetManifest: any, body: any }} options
 * @returns {any}
 */
function recordRenderedPanelQaDecision(options) {
  const timestamp = new Date().toISOString();
  const manifest = options.renderedAssetManifest;
  const checklist = {
    cytoConsistency: Boolean(options.body?.checklist?.cytoConsistency ?? true),
    pipConsistency: Boolean(options.body?.checklist?.pipConsistency ?? true),
    styleConsistency: Boolean(options.body?.checklist?.styleConsistency ?? true),
    anatomyFidelity: Boolean(options.body?.checklist?.anatomyFidelity ?? true),
    setPieceContinuity: Boolean(options.body?.checklist?.setPieceContinuity ?? true),
    letteringSeparation: Boolean(options.body?.checklist?.letteringSeparation ?? true),
    noVisibleText: Boolean(options.body?.checklist?.noVisibleText ?? true),
    panelOrder: Boolean(options.body?.checklist?.panelOrder ?? true),
    guideProvenance: Boolean(options.body?.checklist?.guideProvenance ?? true),
  };
  const decision = {
    schemaVersion: SCHEMA_VERSION,
    id: createId('rpq'),
    tenantId: manifest.tenantId,
    workflowRunId: manifest.workflowRunId,
    renderedAssetManifestId: manifest.id,
    ...(typeof manifest.renderJobId === 'string' ? { renderJobId: manifest.renderJobId } : {}),
    decision: typeof options.body?.decision === 'string'
      ? options.body.decision
      : (manifest.renderMode === 'stub-placeholder' ? 'structural-only' : 'approved'),
    checklist,
    ...(typeof options.body?.notes === 'string' ? { notes: options.body.notes } : {}),
    reviewerId: options.actor.id,
    reviewerRoles: options.actor.roles,
    createdAt: timestamp,
  };
  assertSchema(options.schemaRegistry, 'contracts/rendered-panel-qa-decision.schema.json', decision);
  options.store.saveArtifact('rendered-panel-qa-decision', decision.id, decision, {
    tenantId: decision.tenantId,
    retentionClass: 'audit-log',
  });
  const workflowRun = options.store.getWorkflowRun(manifest.workflowRunId);

  if (workflowRun) {
    const updatedWorkflowRun = upsertArtifactReference(workflowRun, {
      artifactType: 'rendered-panel-qa-decision',
      artifactId: decision.id,
      status: decision.decision === 'approved' || decision.decision === 'structural-only' ? 'approved' : 'rejected',
    });
    saveWorkflowRunRecord(options.store, options.schemaRegistry, updatedWorkflowRun);
  }

  appendAuditLog(
    options.store,
    options.schemaRegistry,
    options.actor,
    'rendered-panel-qa-decision.create',
    'rendered-asset-manifest',
    manifest.id,
    decision.decision === 'rejected' ? 'error' : 'success',
    `Recorded rendered-panel QA decision ${decision.decision}.`,
    {
      renderedPanelQaDecisionId: decision.id,
      workflowRunId: manifest.workflowRunId,
    },
  );

  return decision;
}

/**
 * @param {{ renderPrompts: any[], attachment: any }} options
 * @returns {any}
 */
function resolveRenderPromptForAttachment(options) {
  if (typeof options.attachment.renderPromptId === 'string') {
    const explicitMatch = options.renderPrompts.find((candidate) => candidate.id === options.attachment.renderPromptId);

    if (!explicitMatch) {
      throw createHttpError(400, `Render prompt ${options.attachment.renderPromptId} is not attached to this workflow run.`);
    }

    return explicitMatch;
  }

  if (typeof options.attachment.panelId !== 'string') {
    throw createHttpError(400, 'Rendered asset attachment requires panelId or renderPromptId.');
  }

  const panelMatches = options.renderPrompts.filter((candidate) => candidate.panelId === options.attachment.panelId);

  if (panelMatches.length === 0) {
    throw createHttpError(400, `No render prompt is attached for panel ${options.attachment.panelId}.`);
  }

  if (panelMatches.length > 1) {
    throw createHttpError(400, `Panel ${options.attachment.panelId} maps to multiple render prompts. Provide renderPromptId explicitly.`);
  }

  return panelMatches[0];
}

/**
 * @param {{ store: PlatformStore, schemaRegistry: any, workflowRun: any, actor: any, attachments: any[] }} options
 * @returns {{ workflowRun: any, renderJob: any, renderAttempt: any, renderedAssetManifest: any, renderedAssets: any[] }}
 */
function attachExternalRenderedAssets(options) {
  if (options.attachments.length === 0) {
    throw createHttpError(400, 'At least one external rendered asset must be provided.');
  }

  const renderGate = assertRenderGuideApprovedForRender(options.store, options.workflowRun);
  const renderPrompts = collectArtifactsForRun(options.store, options.workflowRun)
    .filter((entry) => entry.artifactType === 'render-prompt')
    .map((entry) => entry.artifact);

  if (renderPrompts.length === 0) {
    throw createHttpError(409, 'No render prompts are available for external art attachment.');
  }

  const timestamp = new Date().toISOString();
  const attachmentPlans = options.attachments.map((attachment) => ({
    attachment,
    renderPrompt: resolveRenderPromptForAttachment({
      renderPrompts,
      attachment,
    }),
  }));
  const renderPromptIds = uniqueStrings(attachmentPlans.map((plan) => plan.renderPrompt.id));
  const requiredRenderPromptIds = renderPrompts.map((renderPrompt) => renderPrompt.id);

  if (renderPromptIds.length !== attachmentPlans.length) {
    throw createHttpError(400, 'Each attachment must target a unique panel or render prompt.');
  }

  /** @type {any} */
  const initialRenderJob = {
    schemaVersion: SCHEMA_VERSION,
    id: createId('rjob'),
    tenantId: options.workflowRun.tenantId,
    workflowRunId: options.workflowRun.id,
    status: 'completed',
    approvalStatus: 'pending',
    queueName: 'external-art-attachment',
    provider: 'external-manual',
    model: 'external-handoff',
    renderTargetProfileId: MANUAL_RENDER_TARGET_PROFILE_ID,
    renderingGuideId: renderGate.renderingGuide.id,
    visualReferencePackId: renderGate.visualReferencePack.id,
    renderPromptIds,
    attemptIds: [],
    createdBy: options.actor.id,
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: timestamp,
  };
  assertSchema(options.schemaRegistry, 'contracts/render-job.schema.json', initialRenderJob);
  options.store.saveArtifact('render-job', initialRenderJob.id, initialRenderJob, {
    tenantId: options.workflowRun.tenantId,
  });
  let workflowRun = upsertArtifactReference(options.workflowRun, {
    artifactType: 'render-job',
    artifactId: initialRenderJob.id,
    status: 'generated',
  });
  /** @type {any[]} */
  const renderedAssets = [];

  for (const plan of attachmentPlans) {
    /** @type {any} */
    const renderedAsset = {
      schemaVersion: SCHEMA_VERSION,
      id: createId('ras'),
      tenantId: workflowRun.tenantId,
      workflowRunId: workflowRun.id,
      renderJobId: initialRenderJob.id,
      renderPromptId: plan.renderPrompt.id,
      panelId: plan.renderPrompt.panelId,
      provider: 'external-manual',
      model: 'external-handoff',
      mimeType: plan.attachment.mimeType,
      checksum: plan.attachment.checksum,
      location: plan.attachment.location,
      createdAt: timestamp,
    };

    if (typeof plan.attachment.thumbnailLocation === 'string') {
      renderedAsset.thumbnailLocation = plan.attachment.thumbnailLocation;
    }

    if (typeof plan.attachment.width === 'number') {
      renderedAsset.width = plan.attachment.width;
    }

    if (typeof plan.attachment.height === 'number') {
      renderedAsset.height = plan.attachment.height;
    }

    assertSchema(options.schemaRegistry, 'contracts/rendered-asset.schema.json', renderedAsset);
    options.store.saveArtifact('rendered-asset', renderedAsset.id, renderedAsset, {
      tenantId: workflowRun.tenantId,
    });
    workflowRun = upsertArtifactReference(workflowRun, {
      artifactType: 'rendered-asset',
      artifactId: renderedAsset.id,
      status: 'generated',
    });
    renderedAssets.push(renderedAsset);
  }

  const renderAttempt = {
    schemaVersion: SCHEMA_VERSION,
    id: createId('ratm'),
    renderJobId: initialRenderJob.id,
    workflowRunId: workflowRun.id,
    tenantId: workflowRun.tenantId,
    attemptNumber: 1,
    strategy: 'baseline',
    status: 'succeeded',
    providerRequestId: `manual-attachment:${initialRenderJob.id}`,
    renderedAssetIds: renderedAssets.map((renderedAsset) => renderedAsset.id),
    startedAt: timestamp,
    completedAt: timestamp,
  };
  assertSchema(options.schemaRegistry, 'contracts/render-attempt.schema.json', renderAttempt);
  options.store.saveArtifact('render-attempt', renderAttempt.id, renderAttempt, {
    tenantId: workflowRun.tenantId,
  });
  workflowRun = upsertArtifactReference(workflowRun, {
    artifactType: 'render-attempt',
    artifactId: renderAttempt.id,
    status: 'generated',
  });

  const renderedAssetManifest = {
    schemaVersion: SCHEMA_VERSION,
    id: createId('rman'),
    tenantId: workflowRun.tenantId,
    workflowRunId: workflowRun.id,
    renderJobId: initialRenderJob.id,
    renderTargetProfileId: MANUAL_RENDER_TARGET_PROFILE_ID,
    renderingGuideId: renderGate.renderingGuide.id,
    visualReferencePackId: renderGate.visualReferencePack.id,
    allPanelsRendered: requiredRenderPromptIds.every((renderPromptId) => renderPromptIds.includes(renderPromptId)),
    renderedAssets: renderedAssets.map((renderedAsset) => ({
      renderedAssetId: renderedAsset.id,
      renderPromptId: renderedAsset.renderPromptId,
      panelId: renderedAsset.panelId,
      location: renderedAsset.location,
      checksum: renderedAsset.checksum,
      mimeType: renderedAsset.mimeType,
    })),
    generatedAt: timestamp,
  };
  assertSchema(options.schemaRegistry, 'contracts/rendered-asset-manifest.schema.json', renderedAssetManifest);
  options.store.saveArtifact('rendered-asset-manifest', renderedAssetManifest.id, renderedAssetManifest, {
    tenantId: workflowRun.tenantId,
  });
  workflowRun = upsertArtifactReference(workflowRun, {
    artifactType: 'rendered-asset-manifest',
    artifactId: renderedAssetManifest.id,
    status: 'generated',
  });

  const completedRenderJob = {
    ...initialRenderJob,
    approvalStatus: renderedAssetManifest.allPanelsRendered ? 'approved' : 'pending',
    attemptIds: [renderAttempt.id],
    renderedAssetManifestId: renderedAssetManifest.id,
  };
  assertSchema(options.schemaRegistry, 'contracts/render-job.schema.json', completedRenderJob);
  options.store.saveArtifact('render-job', completedRenderJob.id, completedRenderJob, {
    tenantId: workflowRun.tenantId,
  });
  workflowRun = saveWorkflowRunRecord(options.store, options.schemaRegistry, workflowRun);

  appendAuditLog(
    options.store,
    options.schemaRegistry,
    options.actor,
    'rendered-asset.attach',
    'workflow-run',
    workflowRun.id,
    'success',
    `Attached ${renderedAssets.length} external rendered assets to workflow run ${workflowRun.id}.`,
    {
      renderJobId: completedRenderJob.id,
      renderedAssetCount: renderedAssets.length,
      renderedAssetManifestId: renderedAssetManifest.id,
    },
  );

  return {
    workflowRun,
    renderJob: completedRenderJob,
    renderAttempt,
    renderedAssetManifest,
    renderedAssets,
  };
}

/**
 * @param {{ store: PlatformStore, schemaRegistry: any, renderExecutionService: any, workflowRun: any, actor: any, renderPromptIds?: string[] }} options
 * @returns {{ workflowRun: any, renderJob: any }}
 */
function enqueueRenderJob(options) {
  const renderGate = assertRenderGuideApprovedForRender(options.store, options.workflowRun);
  const renderPrompts = collectArtifactsForRun(options.store, options.workflowRun)
    .filter((entry) => entry.artifactType === 'render-prompt')
    .map((entry) => entry.artifact)
    .filter((renderPrompt) => !options.renderPromptIds || options.renderPromptIds.includes(renderPrompt.id));

  if (renderPrompts.length === 0) {
    throw createHttpError(409, 'No render prompts are available for render execution.');
  }

  let workflowRun = markWorkflowStage(options.workflowRun, 'render-execution', 'running', 'Render execution queued.');
  const renderJob = options.renderExecutionService.createRenderJob({
    workflowRun,
    actor: options.actor,
    renderPromptIds: renderPrompts.map((renderPrompt) => renderPrompt.id),
    renderingGuideId: renderGate.renderingGuide.id,
    visualReferencePackId: renderGate.visualReferencePack.id,
  });

  workflowRun = persistArtifact(
    options.store,
    options.schemaRegistry,
    workflowRun,
    'render-job',
    'contracts/render-job.schema.json',
    renderJob,
  );
  workflowRun = saveWorkflowRunRecord(options.store, options.schemaRegistry, workflowRun);

  return {
    workflowRun,
    renderJob,
  };
}

/**
 * @param {any} renderExecutionService
 * @returns {boolean}
 */
function shouldAwaitRenderExecutionQueue(renderExecutionService) {
  const mode = String(process.env.RENDER_QUEUE_MODE ?? '').trim().toLowerCase();

  if (mode === 'inline') {
    return true;
  }

  if (mode === 'background') {
    return false;
  }

  return renderExecutionService.providerName !== 'openai-image';
}

/**
 * @param {{ queueAdapter: any, renderExecutionService: any, telemetry: any, workflowRunId: string, renderJobId: string }} options
 * @returns {Promise<void>}
 */
async function dispatchRenderExecution(options) {
  const dispatch = options.queueAdapter.enqueue('render-execution', {
    workflowRunId: options.workflowRunId,
    renderJobId: options.renderJobId,
  });

  if (shouldAwaitRenderExecutionQueue(options.renderExecutionService)) {
    await dispatch;
    return;
  }

  void dispatch.catch((/** @type {unknown} */ error) => {
    options.telemetry.error?.('render-job.background-dispatch-failed', {
      renderJobId: options.renderJobId,
      workflowRunId: options.workflowRunId,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

/**
 * @param {{ store: PlatformStore, schemaRegistry: any, workflowSpec: any, workflowRun: any, actor: any }} options
 * @returns {any}
 */
function prepareWorkflowRunForManualRenderExecution(options) {
  assertRenderGuideApprovedForRender(options.store, options.workflowRun);

  if (options.workflowRun.state === 'running' && options.workflowRun.currentStage === 'render-execution') {
    return options.workflowRun;
  }

  if (options.workflowRun.state === 'review') {
    return transitionWorkflow(
      options.store,
      options.schemaRegistry,
      options.workflowSpec,
      options.workflowRun,
      {
        eventType: 'REJECT_TO_STAGE',
        actor: {
          type: 'user',
          id: options.actor.id,
        },
        payload: {
          targetStage: 'render-execution',
        },
        notes: 'Manual render execution requested from review.',
      },
    );
  }

  if (options.workflowRun.state === 'approved' || options.workflowRun.state === 'exported') {
    const reopened = transitionWorkflow(
      options.store,
      options.schemaRegistry,
      options.workflowSpec,
      options.workflowRun,
      {
        eventType: 'REOPEN_REVIEW',
        actor: {
          type: 'user',
          id: options.actor.id,
        },
        notes: 'Manual render execution requested after approval/export.',
      },
    );

    return transitionWorkflow(
      options.store,
      options.schemaRegistry,
      options.workflowSpec,
      reopened,
      {
        eventType: 'REJECT_TO_STAGE',
        actor: {
          type: 'user',
          id: options.actor.id,
        },
        payload: {
          targetStage: 'render-execution',
        },
        notes: 'Manual render execution requested after approval/export.',
      },
    );
  }

  return options.workflowRun;
}

/**
 * @param {{ store: PlatformStore, schemaRegistry: any, workflowSpec: any, workflowRun: any, renderJob: any, renderExecutionService: any, telemetry: any }} options
 * @returns {Promise<any>}
 */
export async function processRenderJob(options) {
  let workflowRun = options.workflowRun;
  assertRenderGuideApprovedForRender(options.store, workflowRun);
  const now = new Date().toISOString();
  let renderJob = {
    ...options.renderJob,
    status: 'running',
    startedAt: options.renderJob.startedAt ?? now,
    completedRenderPromptIds: Array.isArray(options.renderJob.completedRenderPromptIds)
      ? options.renderJob.completedRenderPromptIds
      : [],
    completedRenderCount: Array.isArray(options.renderJob.completedRenderPromptIds)
      ? options.renderJob.completedRenderPromptIds.length
      : 0,
    totalRenderCount: options.renderJob.renderPromptIds.length,
    updatedAt: now,
  };
  options.store.saveArtifact('render-job', renderJob.id, renderJob, {
    tenantId: workflowRun.tenantId,
  });
  const renderPrompts = renderJob.renderPromptIds
    .map((/** @type {string} */ renderPromptId) => options.store.getArtifact('render-prompt', renderPromptId))
    .filter(Boolean);
  const requiredRenderPromptIds = collectArtifactsForRun(options.store, workflowRun)
    .filter((entry) => entry.artifactType === 'render-prompt')
    .map((entry) => entry.artifact.id);
  /** @type {any[]} */
  let renderedAssets = [];
  /** @type {any[]} */
  let bestRenderedAssets = [];
  let lastError = null;

  for (const [attemptIndex, strategy] of options.renderExecutionService.renderTargetProfile.fallbackStrategies.entries()) {
    try {
      renderedAssets = [];

      for (const renderPrompt of renderPrompts) {
        renderJob = {
          ...renderJob,
          activeRenderPromptId: renderPrompt.id,
          completedRenderPromptIds: renderedAssets.map((asset) => asset.renderPromptId),
          completedRenderCount: renderedAssets.length,
          totalRenderCount: renderPrompts.length,
          updatedAt: new Date().toISOString(),
        };
        options.store.saveArtifact('render-job', renderJob.id, renderJob, {
          tenantId: workflowRun.tenantId,
        });
        const renderedImage = await options.renderExecutionService.renderSinglePrompt(renderPrompt, strategy);
        const assetId = createId('ras');
        const documentRecord = options.store.saveDocument('render-output', assetId, renderedImage.buffer, {
          tenantId: workflowRun.tenantId,
          contentType: renderedImage.mimeType,
          extension: renderedImage.mimeType === 'image/png' ? 'png' : 'bin',
          retentionClass: 'approved-artifact',
        });
        const renderedAsset = options.renderExecutionService.buildRenderedAsset({
          workflowRun,
          renderJob,
          renderPrompt,
          renderedImage,
          location: documentRecord.location,
          thumbnailLocation: documentRecord.location,
        });
        renderedAsset.id = assetId;
        assertSchema(options.schemaRegistry, 'contracts/rendered-asset.schema.json', renderedAsset);
        options.store.saveArtifact('rendered-asset', renderedAsset.id, renderedAsset, {
          tenantId: workflowRun.tenantId,
        });
        workflowRun = upsertArtifactReference(workflowRun, {
          artifactType: 'rendered-asset',
          artifactId: renderedAsset.id,
          status: 'generated',
        });
        renderedAssets.push(renderedAsset);
        if (renderedAssets.length > bestRenderedAssets.length) {
          bestRenderedAssets = [...renderedAssets];
        }
        renderJob = {
          ...renderJob,
          completedRenderPromptIds: renderedAssets.map((asset) => asset.renderPromptId),
          completedRenderCount: renderedAssets.length,
          totalRenderCount: renderPrompts.length,
          updatedAt: new Date().toISOString(),
        };
        options.store.saveArtifact('render-job', renderJob.id, renderJob, {
          tenantId: workflowRun.tenantId,
        });
      }

      const renderAttempt = options.renderExecutionService.buildRenderAttempt({
        workflowRun,
        renderJobId: renderJob.id,
        attemptNumber: attemptIndex + 1,
        strategy,
        status: 'succeeded',
        providerRequestId: `${renderJob.id}.${strategy}`,
        renderedAssetIds: renderedAssets.map((asset) => asset.id),
      });
      assertSchema(options.schemaRegistry, 'contracts/render-attempt.schema.json', renderAttempt);
      options.store.saveArtifact('render-attempt', renderAttempt.id, renderAttempt, {
        tenantId: workflowRun.tenantId,
      });
      workflowRun = upsertArtifactReference(workflowRun, {
        artifactType: 'render-attempt',
        artifactId: renderAttempt.id,
        status: 'generated',
      });

      const renderedAssetManifest = options.renderExecutionService.buildRenderedAssetManifest({
        workflowRun,
        renderJob,
        renderedAssets,
        requiredRenderPromptIds,
      });
      assertSchema(options.schemaRegistry, 'contracts/rendered-asset-manifest.schema.json', renderedAssetManifest);
      options.store.saveArtifact('rendered-asset-manifest', renderedAssetManifest.id, renderedAssetManifest, {
        tenantId: workflowRun.tenantId,
      });
      workflowRun = upsertArtifactReference(workflowRun, {
        artifactType: 'rendered-asset-manifest',
        artifactId: renderedAssetManifest.id,
        status: 'generated',
      });

      const completedRenderJob = {
        ...renderJob,
      };
      delete completedRenderJob.activeRenderPromptId;
      renderJob = {
        ...completedRenderJob,
        status: 'completed',
        approvalStatus: renderedAssetManifest.allPanelsRendered ? 'approved' : 'pending',
        attemptIds: [...(renderJob.attemptIds ?? []), renderAttempt.id],
        renderedAssetManifestId: renderedAssetManifest.id,
        completedRenderPromptIds: renderedAssets.map((asset) => asset.renderPromptId),
        completedRenderCount: renderedAssets.length,
        totalRenderCount: renderPrompts.length,
        updatedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };
      options.store.saveArtifact('render-job', renderJob.id, renderJob, {
        tenantId: workflowRun.tenantId,
      });
      if (!renderedAssetManifest.allPanelsRendered) {
        options.telemetry.info('render-job.partial-completed', {
          renderJobId: renderJob.id,
          workflowRunId: workflowRun.id,
          renderedAssetCount: renderedAssets.length,
          requiredRenderCount: requiredRenderPromptIds.length,
        });
        return renderJob;
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
            id: 'render-execution-stage',
          },
          payload: {
            renderJobId: renderJob.id,
            renderedAssetManifestId: renderedAssetManifest.id,
            renderedAssetIds: renderedAssets.map((asset) => asset.id),
          },
          notes: 'Rendered assets generated successfully.',
        },
      );
      workflowRun = ensureKnowledgePackReviewWorkItem({
        store: options.store,
        schemaRegistry: options.schemaRegistry,
        workflowRun,
      });
      options.telemetry.info('render-job.completed', {
        renderJobId: renderJob.id,
        workflowRunId: workflowRun.id,
        renderedAssetCount: renderedAssets.length,
      });
      return renderJob;
    } catch (error) {
      lastError = error;
      if (renderedAssets.length > bestRenderedAssets.length) {
        bestRenderedAssets = [...renderedAssets];
      }
      const renderAttempt = options.renderExecutionService.buildRenderAttempt({
        workflowRun,
        renderJobId: renderJob.id,
        attemptNumber: attemptIndex + 1,
        strategy,
        status: 'failed',
        providerRequestId: `${renderJob.id}.${strategy}`,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      assertSchema(options.schemaRegistry, 'contracts/render-attempt.schema.json', renderAttempt);
      options.store.saveArtifact('render-attempt', renderAttempt.id, renderAttempt, {
        tenantId: workflowRun.tenantId,
      });
      workflowRun = upsertArtifactReference(workflowRun, {
        artifactType: 'render-attempt',
        artifactId: renderAttempt.id,
        status: 'rejected',
      });
      renderJob = {
        ...renderJob,
        attemptIds: [...(renderJob.attemptIds ?? []), renderAttempt.id],
        updatedAt: new Date().toISOString(),
        lastError: error instanceof Error ? error.message : String(error),
      };
      options.store.saveArtifact('render-job', renderJob.id, renderJob, {
        tenantId: workflowRun.tenantId,
      });
    }
  }

  renderJob = {
    ...renderJob,
    status: 'retry-required',
    completedRenderPromptIds: bestRenderedAssets.map((asset) => asset.renderPromptId),
    completedRenderCount: bestRenderedAssets.length,
    totalRenderCount: requiredRenderPromptIds.length || renderPrompts.length,
    updatedAt: new Date().toISOString(),
    lastError: lastError instanceof Error ? lastError.message : String(lastError),
  };
  options.store.saveArtifact('render-job', renderJob.id, renderJob, {
    tenantId: workflowRun.tenantId,
  });
  const retryWorkItem = buildWorkItem({
    tenantId: workflowRun.tenantId,
    workflowRunId: workflowRun.id,
    workType: 'render-retry',
    queueName: 'render-review',
    subjectType: 'render-job',
    subjectId: renderJob.id,
    reason: 'default',
    priority: 'high',
    originType: 'render-job',
    originId: renderJob.id,
    notes: [renderJob.lastError ?? 'Render execution failed after automatic retries.'],
  });
  assertSchema(options.schemaRegistry, 'contracts/work-item.schema.json', retryWorkItem);
  options.store.saveArtifact('work-item', retryWorkItem.id, retryWorkItem, {
    tenantId: workflowRun.tenantId,
  });
  workflowRun = upsertArtifactReference(workflowRun, {
    artifactType: 'work-item',
    artifactId: retryWorkItem.id,
    status: 'generated',
  });
  workflowRun = transitionWorkflow(
    options.store,
    options.schemaRegistry,
    options.workflowSpec,
    workflowRun,
    {
      eventType: 'REQUEST_REVIEW',
      actor: {
        type: 'system',
        id: 'render-execution-stage',
      },
      payload: {
        renderJobId: renderJob.id,
        retryWorkItemId: retryWorkItem.id,
      },
      notes: 'Automatic render retries exhausted and human review is required.',
    },
  );
  saveWorkflowRunRecord(
    options.store,
    options.schemaRegistry,
    withPauseReason(workflowRun, 'render-retry-required'),
  );
  options.telemetry.warn('render-job.retry-required', {
    renderJobId: renderJob.id,
    workflowRunId: workflowRun.id,
    lastError: renderJob.lastError,
  });
  return renderJob;
}

/**
 * @param {{ store: PlatformStore, schemaRegistry: any, workflowSpec: any, queueAdapter: any, renderExecutionService: any, workflowRun: any, actor: any, telemetry: any }} options
 * @returns {Promise<any>}
 */
async function resumeRenderExecutionIfReady(options) {
  if (options.workflowRun.currentStage !== 'render-execution' || options.workflowRun.state !== 'running') {
    return options.workflowRun;
  }

  const gateState = getRenderGuideGateState(options.store, options.workflowRun);

  if (!gateState.approved) {
    const pausedWorkflowRun = transitionWorkflow(
      options.store,
      options.schemaRegistry,
      options.workflowSpec,
      options.workflowRun,
      {
        eventType: 'REQUEST_REVIEW',
        actor: {
          type: 'system',
          id: 'render-guide-review-gate',
        },
        payload: {
          gateStatus: gateState.status,
          pauseReason: 'render-guide-review-required',
        },
        notes: gateState.renderDisabledReason,
      },
    );
    return saveWorkflowRunRecord(
      options.store,
      options.schemaRegistry,
      withPauseReason(pausedWorkflowRun, 'render-guide-review-required'),
    );
  }

  const existingRenderableJob = listRenderJobsForRun(options.store, options.workflowRun)
    .find((renderJob) => renderJob.status === 'queued' || renderJob.status === 'running');

  if (existingRenderableJob) {
    return options.store.getWorkflowRun(options.workflowRun.id) ?? options.workflowRun;
  }

  const queued = enqueueRenderJob({
    store: options.store,
    schemaRegistry: options.schemaRegistry,
    renderExecutionService: options.renderExecutionService,
    workflowRun: options.workflowRun,
    actor: options.actor,
  });
  await dispatchRenderExecution({
    queueAdapter: options.queueAdapter,
    renderExecutionService: options.renderExecutionService,
    telemetry: options.telemetry,
    workflowRunId: queued.workflowRun.id,
    renderJobId: queued.renderJob.id,
  });
  options.telemetry.info('render-job.auto-queued', {
    renderJobId: queued.renderJob.id,
    workflowRunId: queued.workflowRun.id,
  });
  return options.store.getWorkflowRun(queued.workflowRun.id) ?? queued.workflowRun;
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

  if (requiresKnowledgePackDecision(options.store, options.workflowRun)) {
    throw createHttpError(409, 'Export requires reviewer approval or promotion of the provisional disease knowledge pack.');
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
  const renderingGuide = loadLatestArtifact(options.store, options.workflowRun, 'rendering-guide');

  if (renderingGuide) {
    releasePackage.releaseBundle.renderingGuideId = renderingGuide.id;
    const renderingGuideMetadata = options.store.getArtifactMetadata('rendering-guide', renderingGuide.id);
    releasePackage.releaseBundle.renderingGuideLocation = renderingGuideMetadata?.location ?? renderingGuide.markdownLocation;
    releasePackage.releaseBundle.renderingGuideMarkdownDocumentId = renderingGuide.markdownDocumentId;
    releasePackage.releaseBundle.renderingGuideMarkdownLocation = renderingGuide.markdownLocation;
  }

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
 * @param {{
 *   rootDir?: string,
 *   store?: PlatformStore,
 *   dbFilePath?: string,
 *   objectStoreDir?: string,
 *   webDistDir?: string,
 *   queueBackend?: string,
 *   telemetryBackend?: string,
 *   serviceBusConnectionString?: string,
 *   metadataStorePool?: any,
 *   localStorageOnly?: boolean,
 *   renderProvider?: string,
 *   researchAssemblyService?: any,
 *   openaiApiKey?: string,
 *   researchModel?: string,
 *   renderProviderApiKey?: string,
 * }} [options]
 * @returns {Promise<{ server: import('node:http').Server, store: PlatformStore }>}
 */
export async function createApp(options = {}) {
  const rootDir = options.rootDir ?? findRepoRoot(import.meta.url);
  const dbFilePath = options.dbFilePath ?? process.env.PLATFORM_DB_FILE ?? path.join(rootDir, 'var', 'db', 'platform.sqlite');
  const objectStoreDir = options.objectStoreDir ?? process.env.OBJECT_STORE_DIR ?? path.join(rootDir, 'var', 'object-store');
  const webDistDir = options.webDistDir ?? path.join(rootDir, 'apps', 'web', 'dist');
  const platformRuntime = createPlatformRuntime({
    rootDir,
    objectStoreDir,
    queueBackend: options.queueBackend,
    telemetryBackend: options.telemetryBackend,
    serviceBusConnectionString: options.serviceBusConnectionString,
    localStorageOnly: options.localStorageOnly,
  });
  const store = options.store ?? await createMetadataStore({
    rootDir,
    dbFilePath,
    objectStoreDir,
    objectStorage: platformRuntime.objectStorage,
    metadataStoreKind: platformRuntime.metadataStoreKind,
    postgresPool: options.metadataStorePool,
    telemetry: platformRuntime.telemetry,
  });
  const schemaRegistry = await createSchemaRegistry(rootDir);
  const workflowSpec = await loadWorkflowSpec(rootDir);
  const clinicalService = createClinicalRetrievalService();
  const researchAssemblyService = options.researchAssemblyService ?? createResearchAssemblyService({
    apiKey: options.openaiApiKey,
    model: options.researchModel,
  });
  const storyEngineService = createStoryEngineService();
  const exporterService = createExporterService();
  const renderExecutionService = createRenderExecutionService({
    provider: options.renderProvider,
    apiKey: options.renderProviderApiKey ?? options.openaiApiKey,
  });
  const evalService = createEvalService({
    rootDir,
    exporterService,
  });
  const webIndexPath = path.join(webDistDir, 'index.html');

  if (typeof platformRuntime.queueAdapter?.registerHandler === 'function') {
    platformRuntime.queueAdapter.registerHandler('render-execution', async (/** @type {any} */ message) => {
      const workflowRun = store.getWorkflowRun(message.workflowRunId);
      const renderJob = store.getArtifact('render-job', message.renderJobId);

      if (!workflowRun || !renderJob) {
        return;
      }

      await processRenderJob({
        store,
        schemaRegistry,
        workflowSpec,
        workflowRun,
        renderJob,
        renderExecutionService,
        telemetry: platformRuntime.telemetry,
      });
    });
  }

  /**
   * @returns {Promise<boolean>}
   */
  const hasBuiltWebApp = async () => (await directoryExists(webDistDir)) && (await fileExists(webIndexPath));

  /**
   * @param {string} pathname
   * @returns {string | null}
   */
  const resolveWebAssetPath = (pathname) => {
    const candidatePath = path.normalize(path.join(webDistDir, pathname.replace(/^\/+/, '')));
    const relativePath = path.relative(webDistDir, candidatePath);

    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      return null;
    }

    return candidatePath;
  };

  /**
   * @param {string} pathname
   * @param {import('node:http').ServerResponse} response
   * @returns {Promise<boolean>}
   */
  const tryServeWebAsset = async (pathname, response) => {
    const candidatePath = resolveWebAssetPath(pathname);

    if (!candidatePath || !(await fileExists(candidatePath))) {
      return false;
    }

    await sendStaticFile(response, candidatePath);
    return true;
  };

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

      const builtWebAppAvailable = method === 'GET'
        ? await hasBuiltWebApp()
        : false;

      if (method === 'GET' && pathname === '/debug/intake') {
        sendHtml(response, 200, renderIntakePage({ actor }));
        return;
      }

      if (method === 'GET' && pathname === '/debug/review') {
        if (!canViewTenantData(actor)) {
          throw createHttpError(403, 'Actor cannot open review pages.');
        }

        const dashboardContext = buildReviewDashboardContext({
          store,
          schemaRegistry,
          actor,
          requestUrl,
        });

        sendHtml(response, 200, renderReviewDashboard({
          actor,
          workflowRuns: dashboardContext.workflowRuns,
          projectsById: dashboardContext.projectsById,
          filters: dashboardContext.filters,
          runSummaries: dashboardContext.runSummaries,
        }));
        return;
      }

      const debugReviewRunPath = matchDebugReviewRunPath(pathname);

      if (method === 'GET' && debugReviewRunPath) {
        const reviewRunContext = buildReviewRunContext({
          store,
          schemaRegistry,
          clinicalService,
          actor,
          runId: debugReviewRunPath.runId,
        });

        sendHtml(response, 200, renderReviewRunPage({
          actor,
          project: reviewRunContext.project,
          workflowRun: reviewRunContext.workflowRun,
          artifactGroups: reviewRunContext.artifactGroups,
          auditLogs: reviewRunContext.auditLogs,
          canonicalDisease: reviewRunContext.canonicalDisease,
          canResolveCanonicalization: canResolveCanonicalization(actor),
          approvableRoles: reviewRunContext.approvableRoles,
          clinicalPackage: reviewRunContext.clinicalPackage,
          latestEvalRun: reviewRunContext.latestEvalRun,
          latestEvalStatus: reviewRunContext.latestEvalStatus,
          exportHistory: reviewRunContext.exportHistory,
        }));
        return;
      }

      if (method === 'GET' && builtWebAppAvailable) {
        if (pathname === '/intake') {
          redirect(response, '/review', 302);
          return;
        }

        if (isWebAssetPath(pathname) && await tryServeWebAsset(pathname, response)) {
          return;
        }

        const legacyReviewRunPath = matchReviewRunPath(pathname);
        const legacyClinicalPackagePath = matchLegacyClinicalPackageReviewPath(pathname);
        const legacyEvaluationPath = matchLegacyEvaluationReviewPath(pathname);
        const legacyExportPath = matchLegacyExportReviewPath(pathname);

        if (legacyReviewRunPath) {
          redirect(response, `/runs/${encodeURIComponent(legacyReviewRunPath.runId)}/review`, 302);
          return;
        }

        if (legacyClinicalPackagePath) {
          redirect(response, `/runs/${encodeURIComponent(legacyClinicalPackagePath.runId)}/evidence`, 302);
          return;
        }

        if (legacyEvaluationPath) {
          redirect(response, `/runs/${encodeURIComponent(legacyEvaluationPath.runId)}/evals`, 302);
          return;
        }

        if (legacyExportPath) {
          redirect(response, `/runs/${encodeURIComponent(legacyExportPath.runId)}/bundles`, 302);
          return;
        }

        if (pathname === '/review' || isSpaShellPath(pathname)) {
          await sendStaticFile(response, webIndexPath);
          return;
        }
      }

      if (method === 'GET' && pathname === '/intake') {
        sendHtml(response, 200, renderIntakePage({ actor }));
        return;
      }

      if (method === 'GET' && pathname === '/review') {
        if (!canViewTenantData(actor)) {
          throw createHttpError(403, 'Actor cannot open review pages.');
        }

        const dashboardContext = buildReviewDashboardContext({
          store,
          schemaRegistry,
          actor,
          requestUrl,
        });

        sendHtml(response, 200, renderReviewDashboard({
          actor,
          workflowRuns: dashboardContext.workflowRuns,
          projectsById: dashboardContext.projectsById,
          filters: dashboardContext.filters,
          runSummaries: dashboardContext.runSummaries,
        }));
        return;
      }

      const reviewRunPath = matchReviewRunPath(pathname);

      if (method === 'GET' && reviewRunPath) {
        const reviewRunContext = buildReviewRunContext({
          store,
          schemaRegistry,
          clinicalService,
          actor,
          runId: reviewRunPath.runId,
        });

        sendHtml(response, 200, renderReviewRunPage({
          actor,
          project: reviewRunContext.project,
          workflowRun: reviewRunContext.workflowRun,
          artifactGroups: reviewRunContext.artifactGroups,
          auditLogs: reviewRunContext.auditLogs,
          canonicalDisease: reviewRunContext.canonicalDisease,
          canResolveCanonicalization: canResolveCanonicalization(actor),
          approvableRoles: reviewRunContext.approvableRoles,
          clinicalPackage: reviewRunContext.clinicalPackage,
          latestEvalRun: reviewRunContext.latestEvalRun,
          latestEvalStatus: reviewRunContext.latestEvalStatus,
          exportHistory: reviewRunContext.exportHistory,
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
        await resumeRenderExecutionIfReady({
          store,
          schemaRegistry,
          workflowSpec,
          queueAdapter: platformRuntime.queueAdapter,
          renderExecutionService,
          workflowRun: updatedWorkflowRun,
          actor,
          telemetry: platformRuntime.telemetry,
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

        const rebuiltRun = rebuildClinicalPackageForRun({
          store,
          schemaRegistry,
          workflowSpec,
          clinicalService,
          storyEngineService,
          workflowRun,
          actor,
          reason: body.reason,
        });
        await resumeRenderExecutionIfReady({
          store,
          schemaRegistry,
          workflowSpec,
          queueAdapter: platformRuntime.queueAdapter,
          renderExecutionService,
          workflowRun: rebuiltRun,
          actor,
          telemetry: platformRuntime.telemetry,
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
          supersededBy: body.supersededBy || undefined,
        });
        const rebuiltRun = rebuildClinicalPackageForRun({
          store,
          schemaRegistry,
          workflowSpec,
          clinicalService,
          storyEngineService,
          workflowRun,
          actor,
          reason: `Recomputed the clinical package after source governance for ${sourceRecord.id}.`,
        });
        await resumeRenderExecutionIfReady({
          store,
          schemaRegistry,
          workflowSpec,
          queueAdapter: platformRuntime.queueAdapter,
          renderExecutionService,
          workflowRun: rebuiltRun,
          actor,
          telemetry: platformRuntime.telemetry,
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
        const rebuiltRun = rebuildClinicalPackageForRun({
          store,
          schemaRegistry,
          workflowSpec,
          clinicalService,
          storyEngineService,
          workflowRun,
          actor,
          reason: `Recomputed the clinical package after contradiction resolution for ${evidenceRecord.claimId}.`,
        });
        await resumeRenderExecutionIfReady({
          store,
          schemaRegistry,
          workflowSpec,
          queueAdapter: platformRuntime.queueAdapter,
          renderExecutionService,
          workflowRun: rebuiltRun,
          actor,
          telemetry: platformRuntime.telemetry,
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

      if (method === 'GET' && isReviewDashboardViewPath(pathname)) {
        if (!canViewTenantData(actor)) {
          throw createHttpError(403, 'Actor cannot read review dashboard data.');
        }

        const dashboardView = createReviewDashboardView(buildReviewDashboardContext({
          store,
          schemaRegistry,
          actor,
          requestUrl,
        }));
        assertSchema(schemaRegistry, 'contracts/review-dashboard-view.schema.json', dashboardView);
        sendJson(response, 200, dashboardView);
        return;
      }

      if (method === 'GET' && isReviewQueueViewPath(pathname)) {
        if (!canViewTenantData(actor)) {
          throw createHttpError(403, 'Actor cannot read review queue data.');
        }

        escalateOverdueWorkItems(store, actor.tenantId);
        const accessibleProjects = store.listProjects().filter((project) => canAccessTenant(actor, getTenantId(project)));
        const accessibleWorkflowRuns = store.listWorkflowRuns().filter((workflowRun) => canAccessTenant(actor, getTenantId(workflowRun)));
        const queueView = buildReviewQueueView(
          store,
          accessibleWorkflowRuns,
          new Map(accessibleProjects.map((project) => [project.id, project])),
          requestUrl.searchParams,
        );
        assertSchema(schemaRegistry, 'contracts/review-queue-view.schema.json', queueView);
        sendJson(response, 200, queueView);
        return;
      }

      if (method === 'GET' && isReviewQueueAnalyticsPath(pathname)) {
        if (!canViewTenantData(actor)) {
          throw createHttpError(403, 'Actor cannot read review queue analytics.');
        }

        escalateOverdueWorkItems(store, actor.tenantId);
        const accessibleWorkflowRuns = store.listWorkflowRuns().filter((workflowRun) => canAccessTenant(actor, getTenantId(workflowRun)));
        const queueAnalyticsView = buildReviewQueueAnalyticsView(store, accessibleWorkflowRuns);
        assertSchema(schemaRegistry, 'contracts/review-queue-analytics-view.schema.json', queueAnalyticsView);
        sendJson(response, 200, queueAnalyticsView);
        return;
      }

      if (method === 'GET' && isReviewQueueAnalyticsHistoryPath(pathname)) {
        if (!canViewTenantData(actor)) {
          throw createHttpError(403, 'Actor cannot read queue analytics history.');
        }

        const snapshots = listTenantArtifactsByType(store, 'review-queue-analytics-snapshot', actor.tenantId)
          .slice(0, 12);
        snapshots.forEach((snapshot) => assertSchema(schemaRegistry, 'contracts/review-queue-analytics-snapshot.schema.json', snapshot));
        sendJson(response, 200, snapshots);
        return;
      }

      if (method === 'POST' && isReviewQueueAnalyticsSnapshotPath(pathname)) {
        if (!canViewTenantData(actor)) {
          throw createHttpError(403, 'Actor cannot capture queue analytics snapshots.');
        }

        const body = await readJsonBody(request).catch(() => ({}));
        escalateOverdueWorkItems(store, actor.tenantId);
        const accessibleWorkflowRuns = store.listWorkflowRuns().filter((workflowRun) => canAccessTenant(actor, getTenantId(workflowRun)));
        const queueAnalyticsView = buildReviewQueueAnalyticsView(store, accessibleWorkflowRuns);
        const snapshot = buildReviewQueueAnalyticsSnapshot({
          tenantId: actor.tenantId,
          analytics: queueAnalyticsView,
          actor,
          snapshotLabel: isRecord(body) && typeof body.snapshotLabel === 'string' ? body.snapshotLabel : undefined,
        });
        assertSchema(schemaRegistry, 'contracts/review-queue-analytics-snapshot.schema.json', snapshot);
        store.saveArtifact('review-queue-analytics-snapshot', snapshot.id, snapshot, {
          tenantId: actor.tenantId,
          retentionClass: 'audit-log',
        });
        appendAuditLog(
          store,
          schemaRegistry,
          actor,
          'review-queue.analytics-snapshot',
          'artifact',
          snapshot.id,
          'success',
          `Captured queue analytics snapshot ${snapshot.snapshotLabel}.`,
        );
        sendJson(response, 201, snapshot);
        return;
      }

      if (method === 'POST' && isReviewQueueProofScenarioPath(pathname)) {
        if (!canViewTenantData(actor)) {
          throw createHttpError(403, 'Actor cannot seed queue proof data.');
        }

        const proofScenario = createQueueProofScenario({
          store,
          schemaRegistry,
          clinicalService,
          actor,
          rootDir,
        });
        sendJson(response, 201, proofScenario);
        return;
      }

      if (method === 'GET' && isNotificationsPath(pathname)) {
        if (!canViewTenantData(actor)) {
          throw createHttpError(403, 'Actor cannot read notifications.');
        }

        const notifications = listNotificationsForActor({
          store,
          actor,
        });
        notifications.forEach((notification) => assertSchema(schemaRegistry, 'contracts/notification.schema.json', notification));
        sendJson(response, 200, notifications);
        return;
      }

      if (method === 'PATCH' && isNotificationsPath(pathname)) {
        if (!canViewTenantData(actor)) {
          throw createHttpError(403, 'Actor cannot update notifications.');
        }

        const body = await readJsonBody(request);

        if (!isRecord(body) || body.status !== 'read') {
          throw createHttpError(400, 'Bulk notification updates currently support status=read only.');
        }

        const timestamp = new Date().toISOString();
        const notifications = listNotificationsForActor({
          store,
          actor,
        }).map((notification) => ({
          ...notification,
          status: notification.status === 'archived' ? notification.status : 'read',
          readAt: notification.readAt ?? timestamp,
          updatedAt: timestamp,
        }));

        notifications.forEach((notification) => {
          assertSchema(schemaRegistry, 'contracts/notification.schema.json', notification);
          store.saveArtifact('notification', notification.id, notification, {
            tenantId: notification.tenantId,
          });
        });
        sendJson(response, 200, notifications);
        return;
      }

      const notificationPath = matchNotificationPath(pathname);

      if (method === 'PATCH' && notificationPath) {
        const notification = store.getArtifact('notification', notificationPath.notificationId);

        if (!notification) {
          throw createHttpError(404, 'Notification not found.');
        }

        assertTenantAccess(actor, notification.tenantId, store, schemaRegistry, 'notification.update', 'notification', notification.id);
        const body = await readJsonBody(request);

        if (!isRecord(body) || (body.status !== 'read' && body.status !== 'archived' && body.status !== 'unread')) {
          throw createHttpError(400, 'Notification updates require a supported status value.');
        }

        const updatedNotification = {
          ...notification,
          status: body.status,
          updatedAt: new Date().toISOString(),
          ...(body.status === 'read' ? { readAt: new Date().toISOString() } : {}),
        };
        assertSchema(schemaRegistry, 'contracts/notification.schema.json', updatedNotification);
        store.saveArtifact('notification', updatedNotification.id, updatedNotification, {
          tenantId: updatedNotification.tenantId,
        });
        sendJson(response, 200, updatedNotification);
        return;
      }

      const workflowRunReviewViewPath = matchWorkflowRunReviewViewPath(pathname);
      const workflowRunRenderingGuidePath = matchWorkflowRunRenderingGuidePath(pathname);
      const workflowRunRenderingGuideRegeneratePath = matchWorkflowRunRenderingGuideRegeneratePath(pathname);
      const workflowRunRenderingGuideReviewPath = matchWorkflowRunRenderingGuideReviewPath(pathname);
      const workflowRunRenderingGuideReviewDecisionPath = matchWorkflowRunRenderingGuideReviewDecisionPath(pathname);
      const workflowRunVisualReferencePackRegeneratePath = matchWorkflowRunVisualReferencePackRegeneratePath(pathname);
      const workflowRunResearchBriefPath = matchWorkflowRunResearchBriefPath(pathname);
      const workflowRunKnowledgePackBuildReportPath = matchWorkflowRunKnowledgePackBuildReportPath(pathname);
      const workflowRunKnowledgePackRegeneratePath = matchWorkflowRunKnowledgePackRegeneratePath(pathname);
      const workflowRunKnowledgePackApprovePath = matchWorkflowRunKnowledgePackApprovePath(pathname);
      const workflowRunKnowledgePackPromotePath = matchWorkflowRunKnowledgePackPromotePath(pathname);

      if (method === 'GET' && workflowRunReviewViewPath) {
        const reviewRunContext = buildReviewRunContext({
          store,
          schemaRegistry,
          clinicalService,
          actor,
          runId: workflowRunReviewViewPath.runId,
        });

        if (!reviewRunContext.clinicalPackage) {
          throw createHttpError(409, 'No clinical package is available for this workflow run yet.');
        }

        const reviewRunView = createReviewRunView({
          project: reviewRunContext.project,
          workflowRun: reviewRunContext.workflowRun,
          clinicalPackage: reviewRunContext.clinicalPackage,
          reviewAssignments: reviewRunContext.reviewAssignments,
          reviewComments: reviewRunContext.reviewComments,
          workItems: reviewRunContext.workItems,
          reviewThreads: reviewRunContext.reviewThreads,
          renderingGuide: reviewRunContext.renderingGuide,
          renderJobs: reviewRunContext.renderJobs,
          latestEvalRun: reviewRunContext.latestEvalRun,
          latestEvalStatus: reviewRunContext.latestEvalStatus,
          exportHistory: reviewRunContext.exportHistory,
        });
        assertSchema(schemaRegistry, 'contracts/review-run-view.schema.json', reviewRunView);
        sendJson(response, 200, reviewRunView);
        return;
      }

      if (method === 'GET' && workflowRunResearchBriefPath) {
        const workflowRun = store.getWorkflowRun(workflowRunResearchBriefPath.runId);

        if (!workflowRun) {
          throw createHttpError(404, 'Workflow run not found.');
        }

        assertTenantAccess(actor, getTenantId(workflowRun), store, schemaRegistry, 'research-brief.view', 'workflow-run', workflowRun.id);
        const researchBrief = loadLatestArtifact(store, workflowRun, 'research-brief');

        if (!researchBrief) {
          throw createHttpError(404, 'No research brief is stored for this workflow run.');
        }

        assertSchema(schemaRegistry, 'contracts/research-brief.schema.json', researchBrief);
        sendJson(response, 200, researchBrief);
        return;
      }

      if (method === 'GET' && workflowRunKnowledgePackBuildReportPath) {
        const workflowRun = store.getWorkflowRun(workflowRunKnowledgePackBuildReportPath.runId);

        if (!workflowRun) {
          throw createHttpError(404, 'Workflow run not found.');
        }

        assertTenantAccess(actor, getTenantId(workflowRun), store, schemaRegistry, 'knowledge-pack-build-report.view', 'workflow-run', workflowRun.id);
        const buildReport = loadLatestArtifact(store, workflowRun, 'knowledge-pack-build-report');

        if (!buildReport) {
          throw createHttpError(404, 'No knowledge-pack build report is stored for this workflow run.');
        }

        assertSchema(schemaRegistry, 'contracts/knowledge-pack-build-report.schema.json', buildReport);
        sendJson(response, 200, buildReport);
        return;
      }

      if (method === 'POST' && workflowRunKnowledgePackApprovePath) {
        const workflowRun = store.getWorkflowRun(workflowRunKnowledgePackApprovePath.runId);

        if (!workflowRun) {
          throw createHttpError(404, 'Workflow run not found.');
        }

        assertTenantAccess(actor, getTenantId(workflowRun), store, schemaRegistry, 'knowledge-pack.approve', 'workflow-run', workflowRun.id);
        const body = await readJsonBody(request);
        const result = saveKnowledgePackPromotionDecision({
          store,
          schemaRegistry,
          workflowRun,
          actor,
          decision: 'approved-run-only',
          notes: isRecord(body) && typeof body.notes === 'string' ? body.notes : undefined,
        });
        sendJson(response, 200, result.workflowRun);
        return;
      }

      if (method === 'POST' && workflowRunKnowledgePackPromotePath) {
        const workflowRun = store.getWorkflowRun(workflowRunKnowledgePackPromotePath.runId);

        if (!workflowRun) {
          throw createHttpError(404, 'Workflow run not found.');
        }

        assertTenantAccess(actor, getTenantId(workflowRun), store, schemaRegistry, 'knowledge-pack.promote', 'workflow-run', workflowRun.id);
        const body = await readJsonBody(request);
        const result = saveKnowledgePackPromotionDecision({
          store,
          schemaRegistry,
          workflowRun,
          actor,
          decision: 'promoted-to-library',
          notes: isRecord(body) && typeof body.notes === 'string' ? body.notes : undefined,
        });
        sendJson(response, 200, result.workflowRun);
        return;
      }

      if (method === 'POST' && workflowRunKnowledgePackRegeneratePath) {
        const workflowRun = store.getWorkflowRun(workflowRunKnowledgePackRegeneratePath.runId);

        if (!workflowRun) {
          throw createHttpError(404, 'Workflow run not found.');
        }

        assertTenantAccess(actor, getTenantId(workflowRun), store, schemaRegistry, 'knowledge-pack.regenerate', 'workflow-run', workflowRun.id);
        const existingKnowledgePack = loadLatestKnowledgePackForRun(store, workflowRun);

        if (!existingKnowledgePack || existingKnowledgePack.packStatus !== 'provisional') {
          throw createHttpError(409, 'Only provisional knowledge packs can be regenerated through research assembly.');
        }

        const researchAssembly = await researchAssemblyService.compileProvisionalKnowledgePack({
          workflowRun,
          workflowInput: clone(workflowRun.input),
          canonicalDisease: {
            schemaVersion: SCHEMA_VERSION,
            id: createId('can'),
            rawInput: workflowRun.input.diseaseName,
            normalizedInput: normalizeDiseaseInput(workflowRun.input.diseaseName),
            resolutionStatus: 'new-disease',
            confidence: 0.56,
            canonicalDiseaseName: existingKnowledgePack.canonicalDiseaseName,
            candidateMatches: [],
          },
          actor,
        });
        let updatedWorkflowRun = persistArtifact(
          store,
          schemaRegistry,
          workflowRun,
          'research-brief',
          'contracts/research-brief.schema.json',
          researchAssembly.researchBrief,
        );
        updatedWorkflowRun = persistArtifact(
          store,
          schemaRegistry,
          updatedWorkflowRun,
          'source-harvest',
          'contracts/source-harvest.schema.json',
          researchAssembly.sourceHarvest,
        );
        updatedWorkflowRun = persistArtifact(
          store,
          schemaRegistry,
          updatedWorkflowRun,
          'knowledge-pack-build-report',
          'contracts/knowledge-pack-build-report.schema.json',
          researchAssembly.buildReport,
          researchAssembly.buildReport.status === 'blocked' ? 'rejected' : 'generated',
        );
        updatedWorkflowRun = persistArtifact(
          store,
          schemaRegistry,
          updatedWorkflowRun,
          'disease-knowledge-pack',
          'contracts/disease-knowledge-pack.schema.json',
          researchAssembly.knowledgePack,
          'generated',
        );

        updatedWorkflowRun = rebuildClinicalPackageForRun({
          store,
          schemaRegistry,
          workflowSpec,
          clinicalService,
          storyEngineService,
          workflowRun: updatedWorkflowRun,
          actor,
          reason: 'Regenerated the provisional knowledge pack from research assembly and rebuilt the clinical package.',
        });
        updatedWorkflowRun = await resumeRenderExecutionIfReady({
          store,
          schemaRegistry,
          workflowSpec,
          queueAdapter: platformRuntime.queueAdapter,
          renderExecutionService,
          workflowRun: updatedWorkflowRun,
          actor,
          telemetry: platformRuntime.telemetry,
        });
        sendJson(response, 200, updatedWorkflowRun);
        return;
      }

      if (method === 'GET' && workflowRunRenderingGuidePath) {
        const workflowRun = store.getWorkflowRun(workflowRunRenderingGuidePath.runId);

        if (!workflowRun) {
          throw createHttpError(404, 'Workflow run not found.');
        }

        assertTenantAccess(actor, getTenantId(workflowRun), store, schemaRegistry, 'rendering-guide.view', 'workflow-run', workflowRun.id);
        const renderingGuideView = buildRenderingGuideViewPayload({
          store,
          workflowRun,
        });
        assertSchema(schemaRegistry, 'contracts/rendering-guide-view.schema.json', renderingGuideView);
        sendJson(response, 200, renderingGuideView);
        return;
      }

      if (method === 'GET' && workflowRunRenderingGuideReviewPath) {
        const workflowRun = store.getWorkflowRun(workflowRunRenderingGuideReviewPath.runId);

        if (!workflowRun) {
          throw createHttpError(404, 'Workflow run not found.');
        }

        assertTenantAccess(actor, getTenantId(workflowRun), store, schemaRegistry, 'rendering-guide.review.view', 'workflow-run', workflowRun.id);
        const renderingGuideView = buildRenderingGuideViewPayload({
          store,
          workflowRun,
        });
        assertSchema(schemaRegistry, 'contracts/rendering-guide-view.schema.json', renderingGuideView);
        sendJson(response, 200, renderingGuideView);
        return;
      }

      if (method === 'POST' && workflowRunRenderingGuideRegeneratePath) {
        let workflowRun = store.getWorkflowRun(workflowRunRenderingGuideRegeneratePath.runId);

        if (!workflowRun) {
          throw createHttpError(404, 'Workflow run not found.');
        }

        assertTenantAccess(actor, getTenantId(workflowRun), store, schemaRegistry, 'rendering-guide.regenerate', 'workflow-run', workflowRun.id);
        workflowRun = regenerateRenderingGuideForRun({
          store,
          schemaRegistry,
          workflowRun,
        }).workflowRun;
        workflowRun = ensureRenderGuideReviewWorkItem({
          store,
          schemaRegistry,
          workflowRun: withPauseReason(workflowRun, 'render-guide-review-required'),
        });
        const renderingGuideView = buildRenderingGuideViewPayload({
          store,
          workflowRun,
        });
        assertSchema(schemaRegistry, 'contracts/rendering-guide-view.schema.json', renderingGuideView);
        sendJson(response, 200, renderingGuideView);
        return;
      }

      if (method === 'POST' && workflowRunVisualReferencePackRegeneratePath) {
        let workflowRun = store.getWorkflowRun(workflowRunVisualReferencePackRegeneratePath.runId);

        if (!workflowRun) {
          throw createHttpError(404, 'Workflow run not found.');
        }

        assertTenantAccess(actor, getTenantId(workflowRun), store, schemaRegistry, 'visual-reference-pack.regenerate', 'workflow-run', workflowRun.id);
        workflowRun = regenerateVisualReferencePackForRun({
          store,
          schemaRegistry,
          workflowRun,
        }).workflowRun;
        const renderingGuideView = buildRenderingGuideViewPayload({
          store,
          workflowRun,
        });
        assertSchema(schemaRegistry, 'contracts/rendering-guide-view.schema.json', renderingGuideView);
        sendJson(response, 200, renderingGuideView);
        return;
      }

      if (method === 'POST' && workflowRunRenderingGuideReviewDecisionPath) {
        let workflowRun = store.getWorkflowRun(workflowRunRenderingGuideReviewDecisionPath.runId);

        if (!workflowRun) {
          throw createHttpError(404, 'Workflow run not found.');
        }

        assertTenantAccess(actor, getTenantId(workflowRun), store, schemaRegistry, 'rendering-guide.review', 'workflow-run', workflowRun.id);
        const body = await readJsonBody(request);
        workflowRun = submitRenderGuideReviewDecision({
          store,
          schemaRegistry,
          workflowRun,
          actor,
          payload: body,
        }).workflowRun;
        const renderingGuideView = buildRenderingGuideViewPayload({
          store,
          workflowRun,
        });
        assertSchema(schemaRegistry, 'contracts/rendering-guide-view.schema.json', renderingGuideView);
        sendJson(response, 201, renderingGuideView);
        return;
      }

      const workflowRunArtifactsPath = matchWorkflowRunArtifactsPath(pathname);

      if (method === 'GET' && workflowRunArtifactsPath) {
        const workflowRun = store.getWorkflowRun(workflowRunArtifactsPath.runId);

        if (!workflowRun) {
          throw createHttpError(404, 'Workflow run not found.');
        }

        assertTenantAccess(actor, getTenantId(workflowRun), store, schemaRegistry, 'artifact.view', 'workflow-run', workflowRun.id);
        const artifactListView = buildWorkflowArtifactListViewPayload({
          store,
          workflowRun,
          artifactTypeFilters: parseArtifactTypeFilters(requestUrl.searchParams),
          expand: requestUrl.searchParams.get('expand') === 'true',
        });
        assertSchema(schemaRegistry, 'contracts/workflow-artifact-list-view.schema.json', artifactListView);
        sendJson(response, 200, artifactListView);
        return;
      }

      const workflowRunCommentsPath = matchWorkflowRunCommentsPath(pathname);

      if (workflowRunCommentsPath && method === 'GET') {
        const workflowRun = store.getWorkflowRun(workflowRunCommentsPath.runId);

        if (!workflowRun) {
          throw createHttpError(404, 'Workflow run not found.');
        }

        assertTenantAccess(actor, getTenantId(workflowRun), store, schemaRegistry, 'review-comments.view', 'workflow-run', workflowRun.id);
        const reviewComments = listReviewCommentsForRun(store, workflowRun);
        reviewComments.forEach((reviewComment) => assertSchema(schemaRegistry, 'contracts/review-comment.schema.json', reviewComment));
        sendJson(response, 200, reviewComments);
        return;
      }

      if (workflowRunCommentsPath && method === 'POST') {
        const workflowRun = store.getWorkflowRun(workflowRunCommentsPath.runId);

        if (!workflowRun) {
          throw createHttpError(404, 'Workflow run not found.');
        }

        assertTenantAccess(actor, getTenantId(workflowRun), store, schemaRegistry, 'review-comments.write', 'workflow-run', workflowRun.id);
        const body = await readJsonBody(request);

        if (!isRecord(body)) {
          throw createHttpError(400, 'Review comment payload must be an object.');
        }

        const existingComment = typeof body.id === 'string' ? store.getArtifact('review-comment', body.id) : null;

        if (existingComment && existingComment.workflowRunId !== workflowRun.id) {
          throw createHttpError(409, 'Review comment does not belong to this workflow run.');
        }

        const reviewComment = buildReviewCommentRecord({
          workflowRun,
          actor,
          payload: body,
          existingComment,
        });
        assertSchema(schemaRegistry, 'contracts/review-comment.schema.json', reviewComment);
        store.saveArtifact('review-comment', reviewComment.id, reviewComment, {
          tenantId: workflowRun.tenantId,
        });
        syncCommentThread({
          store,
          schemaRegistry,
          workflowRun,
          reviewComment,
          actor,
        });
        appendAuditLog(
          store,
          schemaRegistry,
          actor,
          existingComment ? 'review-comment.update' : 'review-comment.create',
          'workflow-run',
          workflowRun.id,
          'success',
          `${existingComment ? 'Updated' : 'Created'} review comment ${reviewComment.id}.`,
          {
            artifactId: reviewComment.artifactId,
            artifactType: reviewComment.artifactType,
            commentId: reviewComment.id,
            scopeType: reviewComment.scopeType,
            severity: reviewComment.severity,
            status: reviewComment.status,
          },
        );
        sendJson(response, existingComment ? 200 : 201, reviewComment);
        return;
      }

      const workflowRunAssignmentsPath = matchWorkflowRunAssignmentsPath(pathname);

      if (workflowRunAssignmentsPath && method === 'GET') {
        const workflowRun = store.getWorkflowRun(workflowRunAssignmentsPath.runId);

        if (!workflowRun) {
          throw createHttpError(404, 'Workflow run not found.');
        }

        assertTenantAccess(actor, getTenantId(workflowRun), store, schemaRegistry, 'review-assignments.view', 'workflow-run', workflowRun.id);
        const reviewAssignments = listReviewAssignmentsForRun(store, workflowRun);
        reviewAssignments.forEach((reviewAssignment) => assertSchema(schemaRegistry, 'contracts/review-assignment.schema.json', reviewAssignment));
        sendJson(response, 200, reviewAssignments);
        return;
      }

      if (workflowRunAssignmentsPath && method === 'POST') {
        const workflowRun = store.getWorkflowRun(workflowRunAssignmentsPath.runId);

        if (!workflowRun) {
          throw createHttpError(404, 'Workflow run not found.');
        }

        assertTenantAccess(actor, getTenantId(workflowRun), store, schemaRegistry, 'review-assignments.write', 'workflow-run', workflowRun.id);
        const body = await readJsonBody(request);

        if (!isRecord(body)) {
          throw createHttpError(400, 'Review assignment payload must be an object.');
        }

        const existingAssignment = typeof body.id === 'string' ? store.getArtifact('review-assignment', body.id) : null;

        if (existingAssignment && existingAssignment.workflowRunId !== workflowRun.id) {
          throw createHttpError(409, 'Review assignment does not belong to this workflow run.');
        }

        const reviewAssignment = buildReviewAssignmentRecord({
          workflowRun,
          actor,
          payload: body,
          existingAssignment,
        });
        assertSchema(schemaRegistry, 'contracts/review-assignment.schema.json', reviewAssignment);
        store.saveArtifact('review-assignment', reviewAssignment.id, reviewAssignment, {
          tenantId: workflowRun.tenantId,
        });
        if (typeof reviewAssignment.assigneeId === 'string' || typeof reviewAssignment.assigneeDisplayName === 'string') {
          const notification = {
            schemaVersion: SCHEMA_VERSION,
            id: createId('ntf'),
            tenantId: workflowRun.tenantId,
            targetActorId: reviewAssignment.assigneeId ?? reviewAssignment.assigneeDisplayName,
            workflowRunId: workflowRun.id,
            notificationType: 'assignment',
            status: 'unread',
            message: `${actor.displayName} assigned ${reviewAssignment.reviewRole} review for ${workflowRun.input.diseaseName}.`,
            subjectType: 'workflow-run',
            subjectId: workflowRun.id,
            createdBy: actor.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          assertSchema(schemaRegistry, 'contracts/notification.schema.json', notification);
          store.saveArtifact('notification', notification.id, notification, {
            tenantId: workflowRun.tenantId,
          });
        }
        syncAssignmentWorkItem({
          store,
          schemaRegistry,
          workflowRun,
          reviewAssignment,
        });
        appendAuditLog(
          store,
          schemaRegistry,
          actor,
          existingAssignment ? 'review-assignment.update' : 'review-assignment.create',
          'workflow-run',
          workflowRun.id,
          'success',
          `${existingAssignment ? 'Updated' : 'Created'} review assignment ${reviewAssignment.id}.`,
          {
            assigneeDisplayName: reviewAssignment.assigneeDisplayName,
            assignmentId: reviewAssignment.id,
            reviewRole: reviewAssignment.reviewRole,
            status: reviewAssignment.status,
          },
        );
        sendJson(response, existingAssignment ? 200 : 201, reviewAssignment);
        return;
      }

      const workflowRunThreadsPath = matchWorkflowRunThreadsPath(pathname);

      if (workflowRunThreadsPath && method === 'GET') {
        const workflowRun = store.getWorkflowRun(workflowRunThreadsPath.runId);

        if (!workflowRun) {
          throw createHttpError(404, 'Workflow run not found.');
        }

        assertTenantAccess(actor, getTenantId(workflowRun), store, schemaRegistry, 'review-threads.view', 'workflow-run', workflowRun.id);
        const workItems = listWorkItemsForRun(store, workflowRun);
        const reviewThreads = listReviewThreadsForRun(store, workflowRun).map((reviewThread) => {
          const messages = listMessagesForThread(store, workflowRun.tenantId, reviewThread.id);
          const latestMessage = messages.at(-1) ?? null;
          const linkedWorkItemIds = workItems
            .filter((workItem) => (
              (reviewThread.scopeType === 'run' && workItem.workflowRunId === workflowRun.id)
              || (reviewThread.scopeId && workItem.subjectId === reviewThread.scopeId)
            ))
            .map((workItem) => workItem.id);

          return {
            ...reviewThread,
            messages,
            unreadCount: messages.filter((message) => message.status === 'posted').length,
            latestMessagePreview: latestMessage?.body?.slice(0, 160) ?? '',
            latestMessageAt: latestMessage?.updatedAt,
            openActionCount: linkedWorkItemIds.length,
            linkedWorkItemIds,
          };
        });
        reviewThreads.forEach((reviewThread) => assertSchema(schemaRegistry, 'contracts/review-thread.schema.json', reviewThread));
        sendJson(response, 200, reviewThreads);
        return;
      }

      if (workflowRunThreadsPath && method === 'POST') {
        const workflowRun = store.getWorkflowRun(workflowRunThreadsPath.runId);

        if (!workflowRun) {
          throw createHttpError(404, 'Workflow run not found.');
        }

        assertTenantAccess(actor, getTenantId(workflowRun), store, schemaRegistry, 'review-threads.write', 'workflow-run', workflowRun.id);
        const body = await readJsonBody(request);

        if (!isRecord(body) || typeof body.title !== 'string' || typeof body.scopeType !== 'string') {
          throw createHttpError(400, 'title and scopeType are required for review threads.');
        }

        const reviewThread = ensureReviewThread({
          store,
          schemaRegistry,
          workflowRun,
          actor,
          title: body.title,
          scopeType: body.scopeType,
          scopeId: typeof body.scopeId === 'string' ? body.scopeId : undefined,
        });
        sendJson(response, 201, reviewThread);
        return;
      }

      const reviewThreadMessagesPath = matchReviewThreadMessagesPath(pathname);

      if (reviewThreadMessagesPath && method === 'GET') {
        const reviewThread = store.getArtifact('review-thread', reviewThreadMessagesPath.threadId);

        if (!reviewThread) {
          throw createHttpError(404, 'Review thread not found.');
        }

        assertTenantAccess(actor, reviewThread.tenantId, store, schemaRegistry, 'review-thread-messages.view', 'workflow-run', reviewThread.workflowRunId);
        const messages = listMessagesForThread(store, reviewThread.tenantId, reviewThread.id);
        messages.forEach((message) => assertSchema(schemaRegistry, 'contracts/review-message.schema.json', message));
        sendJson(response, 200, messages);
        return;
      }

      if (reviewThreadMessagesPath && method === 'POST') {
        const reviewThread = store.getArtifact('review-thread', reviewThreadMessagesPath.threadId);

        if (!reviewThread) {
          throw createHttpError(404, 'Review thread not found.');
        }

        const workflowRun = store.getWorkflowRun(reviewThread.workflowRunId);

        if (!workflowRun) {
          throw createHttpError(404, 'Workflow run not found.');
        }

        assertTenantAccess(actor, reviewThread.tenantId, store, schemaRegistry, 'review-thread-messages.write', 'workflow-run', workflowRun.id);
        const body = await readJsonBody(request);

        if (!isRecord(body) || typeof body.body !== 'string') {
          throw createHttpError(400, 'body is required for review thread messages.');
        }

        const reviewMessage = appendThreadMessage({
          store,
          schemaRegistry,
          workflowRun,
          thread: reviewThread,
          actor,
          body: body.body,
          parentMessageId: typeof body.parentMessageId === 'string' ? body.parentMessageId : undefined,
          mentions: Array.isArray(body.mentions) ? body.mentions.filter((value) => typeof value === 'string') : [],
          mentionedActorIds: Array.isArray(body.mentionedActorIds) ? body.mentionedActorIds.filter((value) => typeof value === 'string') : [],
          resolutionNote: typeof body.resolutionNote === 'string' ? body.resolutionNote : undefined,
        });
        sendJson(response, 201, reviewMessage);
        return;
      }

      const workItemPath = matchWorkItemPath(pathname);

      if (workItemPath && method === 'GET') {
        const workItem = store.getArtifact('work-item', workItemPath.workItemId);

        if (!workItem) {
          throw createHttpError(404, 'Work item not found.');
        }

        assertTenantAccess(actor, workItem.tenantId, store, schemaRegistry, 'work-item.view', 'workflow-run', workItem.workflowRunId ?? workItem.subjectId);
        assertSchema(schemaRegistry, 'contracts/work-item.schema.json', workItem);
        sendJson(response, 200, workItem);
        return;
      }

      if (workItemPath && method === 'PATCH') {
        const workItem = store.getArtifact('work-item', workItemPath.workItemId);

        if (!workItem) {
          throw createHttpError(404, 'Work item not found.');
        }

        assertTenantAccess(actor, workItem.tenantId, store, schemaRegistry, 'work-item.write', 'workflow-run', workItem.workflowRunId ?? workItem.subjectId);
        const body = await readJsonBody(request);

        if (!isRecord(body)) {
          throw createHttpError(400, 'Work item patch must be an object.');
        }

        const status = typeof body.status === 'string' ? body.status : workItem.status;

        if (!WORK_ITEM_STATUSES.has(status)) {
          throw createHttpError(400, 'Invalid work item status.');
        }

        const updatedWorkItem = {
          ...workItem,
          status,
          priority: typeof body.priority === 'string' ? body.priority : workItem.priority,
          notes: Array.isArray(body.notes) ? body.notes.filter((value) => typeof value === 'string') : workItem.notes,
          updatedAt: new Date().toISOString(),
          ...(status === 'completed' ? { completedAt: new Date().toISOString() } : {}),
        };
        assertSchema(schemaRegistry, 'contracts/work-item.schema.json', updatedWorkItem);
        store.saveArtifact('work-item', updatedWorkItem.id, updatedWorkItem, {
          tenantId: updatedWorkItem.tenantId,
        });
        sendJson(response, 200, updatedWorkItem);
        return;
      }

      const workflowRunRenderJobsPath = matchWorkflowRunRenderJobsPath(pathname);
      const workflowRunRenderedAssetAttachmentPath = matchWorkflowRunRenderedAssetAttachmentPath(pathname);
      const renderedAssetManifestQaDecisionPath = matchRenderedAssetManifestQaDecisionPath(pathname);

      if (workflowRunRenderedAssetAttachmentPath && method === 'POST') {
        let workflowRun = store.getWorkflowRun(workflowRunRenderedAssetAttachmentPath.runId);

        if (!workflowRun) {
          throw createHttpError(404, 'Workflow run not found.');
        }

        assertTenantAccess(actor, getTenantId(workflowRun), store, schemaRegistry, 'rendered-asset.attach', 'workflow-run', workflowRun.id);
        const body = /** @type {{ assets: any[] }} */ (await readJsonBody(request));
        assertSchema(schemaRegistry, 'contracts/rendered-asset-attachment-request.schema.json', body);
        workflowRun = attachExternalRenderedAssets({
          store,
          schemaRegistry,
          workflowRun,
          actor,
          attachments: body.assets,
        }).workflowRun;
        const renderingGuideView = buildRenderingGuideViewPayload({
          store,
          workflowRun,
        });
        assertSchema(schemaRegistry, 'contracts/rendering-guide-view.schema.json', renderingGuideView);
        sendJson(response, 201, renderingGuideView);
        return;
      }

      if (renderedAssetManifestQaDecisionPath && method === 'GET') {
        const renderedAssetManifest = store.getArtifact('rendered-asset-manifest', renderedAssetManifestQaDecisionPath.manifestId);

        if (!renderedAssetManifest) {
          throw createHttpError(404, 'Rendered asset manifest not found.');
        }

        assertTenantAccess(actor, renderedAssetManifest.tenantId, store, schemaRegistry, 'rendered-panel-qa-decision.view', 'workflow-run', renderedAssetManifest.workflowRunId);
        const decisions = listTenantArtifactsByType(store, 'rendered-panel-qa-decision', renderedAssetManifest.tenantId)
          .filter((decision) => decision.renderedAssetManifestId === renderedAssetManifest.id);
        decisions.forEach((decision) => assertSchema(schemaRegistry, 'contracts/rendered-panel-qa-decision.schema.json', decision));
        sendJson(response, 200, decisions);
        return;
      }

      if (renderedAssetManifestQaDecisionPath && method === 'POST') {
        const renderedAssetManifest = store.getArtifact('rendered-asset-manifest', renderedAssetManifestQaDecisionPath.manifestId);

        if (!renderedAssetManifest) {
          throw createHttpError(404, 'Rendered asset manifest not found.');
        }

        assertTenantAccess(actor, renderedAssetManifest.tenantId, store, schemaRegistry, 'rendered-panel-qa-decision.create', 'workflow-run', renderedAssetManifest.workflowRunId);
        const body = await readJsonBody(request).catch(() => ({}));
        const decision = recordRenderedPanelQaDecision({
          store,
          schemaRegistry,
          actor,
          renderedAssetManifest,
          body,
        });
        sendJson(response, 201, decision);
        return;
      }

      if (workflowRunRenderJobsPath && method === 'POST') {
        const workflowRun = store.getWorkflowRun(workflowRunRenderJobsPath.runId);

        if (!workflowRun) {
          throw createHttpError(404, 'Workflow run not found.');
        }

        assertTenantAccess(actor, getTenantId(workflowRun), store, schemaRegistry, 'render-job.enqueue', 'workflow-run', workflowRun.id);
        const body = await readJsonBody(request);
        const renderPromptIds = isRecord(body) && Array.isArray(body.renderPromptIds)
          ? body.renderPromptIds.filter((value) => typeof value === 'string')
          : undefined;
        const renderReadyRun = prepareWorkflowRunForManualRenderExecution({
          store,
          schemaRegistry,
          workflowSpec,
          workflowRun,
          actor,
        });
        const queued = enqueueRenderJob({
          store,
          schemaRegistry,
          renderExecutionService,
          workflowRun: renderReadyRun,
          actor,
          renderPromptIds,
        });
        appendAuditLog(
          store,
          schemaRegistry,
          actor,
          'render-job.enqueue',
          'workflow-run',
          queued.workflowRun.id,
          'success',
          `Queued render job ${queued.renderJob.id}.`,
          {
            renderJobId: queued.renderJob.id,
            renderPromptCount: queued.renderJob.renderPromptIds.length,
          },
        );
        await dispatchRenderExecution({
          queueAdapter: platformRuntime.queueAdapter,
          renderExecutionService,
          telemetry: platformRuntime.telemetry,
          workflowRunId: queued.workflowRun.id,
          renderJobId: queued.renderJob.id,
        });
        sendJson(response, 202, queued);
        return;
      }

      const renderJobPath = matchRenderJobPath(pathname);

      if (renderJobPath && method === 'GET') {
        const renderJob = store.getArtifact('render-job', renderJobPath.jobId);

        if (!renderJob) {
          throw createHttpError(404, 'Render job not found.');
        }

        assertTenantAccess(actor, renderJob.tenantId, store, schemaRegistry, 'render-job.view', 'workflow-run', renderJob.workflowRunId);
        const attempts = listTenantArtifactsByType(store, 'render-attempt', renderJob.tenantId)
          .filter((attempt) => attempt.renderJobId === renderJob.id);
        const manifest = renderJob.renderedAssetManifestId
          ? store.getArtifact('rendered-asset-manifest', renderJob.renderedAssetManifestId)
          : null;
        const renderedAssets = listTenantArtifactsByType(store, 'rendered-asset', renderJob.tenantId)
          .filter((asset) => asset.renderJobId === renderJob.id);
        sendJson(response, 200, {
          ...renderJob,
          attempts,
          renderedAssets,
          renderedAssetManifest: manifest,
        });
        return;
      }

      const renderJobRetryPath = matchRenderJobRetryPath(pathname);

      if (renderJobRetryPath && method === 'POST') {
        const existingRenderJob = store.getArtifact('render-job', renderJobRetryPath.jobId);

        if (!existingRenderJob) {
          throw createHttpError(404, 'Render job not found.');
        }

        const workflowRun = store.getWorkflowRun(existingRenderJob.workflowRunId);

        if (!workflowRun) {
          throw createHttpError(404, 'Workflow run not found.');
        }

        assertTenantAccess(actor, existingRenderJob.tenantId, store, schemaRegistry, 'render-job.retry', 'workflow-run', workflowRun.id);
        const renderReadyRun = prepareWorkflowRunForManualRenderExecution({
          store,
          schemaRegistry,
          workflowSpec,
          workflowRun,
          actor,
        });
        const queued = enqueueRenderJob({
          store,
          schemaRegistry,
          renderExecutionService,
          workflowRun: renderReadyRun,
          actor,
          renderPromptIds: existingRenderJob.renderPromptIds,
        });
        appendAuditLog(
          store,
          schemaRegistry,
          actor,
          'render-job.retry',
          'workflow-run',
          workflowRun.id,
          'success',
          `Queued retry render job ${queued.renderJob.id} from ${existingRenderJob.id}.`,
          {
            previousRenderJobId: existingRenderJob.id,
            renderJobId: queued.renderJob.id,
          },
        );
        await dispatchRenderExecution({
          queueAdapter: platformRuntime.queueAdapter,
          renderExecutionService,
          telemetry: platformRuntime.telemetry,
          workflowRunId: queued.workflowRun.id,
          renderJobId: queued.renderJob.id,
        });
        sendJson(response, 202, queued);
        return;
      }

      const workflowRunArtifactDiffPath = matchWorkflowRunArtifactDiffPath(pathname);

      if (workflowRunArtifactDiffPath && method === 'GET') {
        const workflowRun = store.getWorkflowRun(workflowRunArtifactDiffPath.runId);

        if (!workflowRun) {
          throw createHttpError(404, 'Workflow run not found.');
        }

        assertTenantAccess(actor, getTenantId(workflowRun), store, schemaRegistry, 'artifact-diff.view', 'workflow-run', workflowRun.id);
        const artifactType = requestUrl.searchParams.get('artifactType');

        if (!artifactType) {
          throw createHttpError(400, 'artifactType is required.');
        }

        const artifactDiffView = buildArtifactDiffViewPayload({
          store,
          workflowRun,
          artifactType,
          leftArtifactId: requestUrl.searchParams.get('leftArtifactId'),
          rightArtifactId: requestUrl.searchParams.get('rightArtifactId'),
        });
        assertSchema(schemaRegistry, 'contracts/artifact-diff-view.schema.json', artifactDiffView);
        sendJson(response, 200, artifactDiffView);
        return;
      }

      if (method === 'GET' && isLocalRuntimeViewPath(pathname)) {
        const storage = {
          dbFilePath: store.dbFilePath,
          objectStoreDir: store.objectStoreDir,
        };
        const runtimeView = createLocalRuntimeView({
          actor,
          tenantId: actor.tenantId,
          serverBaseUrl: getServerBaseUrl(request),
          storage,
          platform: {
            runtimeMode: platformRuntime.runtimeMode,
            metadataStore: platformRuntime.metadataStoreKind,
            objectStore: platformRuntime.objectStorageKind,
            queueBackend: platformRuntime.queueBackend,
            telemetryBackend: process.env.TELEMETRY_BACKEND ?? 'stdout',
          },
          availableCommands: [
            'pnpm dev:api',
            'pnpm dev:worker',
            'pnpm dev:web',
            'pnpm lint',
            'pnpm typecheck',
            'pnpm test',
            'pnpm validate:pack',
            'pnpm build',
            'pnpm eval:run -- --run-id <runId>',
            'pnpm local:backup',
            'pnpm local:reset',
            'pnpm local:restore -- --path var/backups/<timestamp>',
            'pnpm ops:restore-smoke',
          ],
          readiness: getReadinessSnapshot(),
          localStoragePolicy: getLocalStoragePolicy(storage),
          externalElements: getExternalElementsSnapshot(rootDir, renderExecutionService),
        });
        assertSchema(schemaRegistry, 'contracts/local-runtime-view.schema.json', runtimeView);
        sendJson(response, 200, runtimeView);
        return;
      }

      if (method === 'GET' && isLocalOpsStatusPath(pathname)) {
        if (!canViewTenantData(actor)) {
          throw createHttpError(403, 'Actor cannot read local ops status.');
        }

        const localOpsStatus = await buildLocalOpsStatus({
          store,
          rootDir,
          tenantId: actor.tenantId,
        });
        assertSchema(schemaRegistry, 'contracts/local-ops-status.schema.json', localOpsStatus);
        sendJson(response, 200, localOpsStatus);
        return;
      }

      if (method === 'POST' && isLocalOpsRestoreSmokePath(pathname)) {
        if (!canViewTenantData(actor)) {
          throw createHttpError(403, 'Actor cannot run local restore smoke.');
        }

        const restoreSmokeResult = await runLocalRestoreSmoke({
          store,
          schemaRegistry,
          actor,
          rootDir,
        });
        sendJson(response, 201, restoreSmokeResult);
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

        const diseaseResolution = resolveDiseaseInput({
          store,
          clinicalService,
          tenantId: getTenantId(project),
          diseaseInput: workflowInput.diseaseName,
        });
        const canonicalDisease = diseaseResolution.canonicalDisease;
        workflowRun = persistArtifact(
          store,
          schemaRegistry,
          workflowRun,
          'canonical-disease',
          'contracts/canonical-disease.schema.json',
          canonicalDisease,
        );

        if (canonicalDisease.resolutionStatus === 'resolved') {
          workflowRun = continueResolvedPipeline({
            store,
            schemaRegistry,
            workflowSpec,
            workflowRun,
            workflowInput,
            canonicalDisease,
            clinicalService,
            storyEngineService,
            actor,
          });
          workflowRun = await resumeRenderExecutionIfReady({
            store,
            schemaRegistry,
            workflowSpec,
            queueAdapter: platformRuntime.queueAdapter,
            renderExecutionService,
            workflowRun,
            actor,
            telemetry: platformRuntime.telemetry,
          });
        } else if (canonicalDisease.resolutionStatus === 'new-disease') {
          workflowRun = await continueNewDiseasePipeline({
            store,
            schemaRegistry,
            workflowSpec,
            workflowRun,
            workflowInput,
            canonicalDisease,
            clinicalService,
            storyEngineService,
            researchAssemblyService,
            actor,
          });
          workflowRun = await resumeRenderExecutionIfReady({
            store,
            schemaRegistry,
            workflowSpec,
            queueAdapter: platformRuntime.queueAdapter,
            renderExecutionService,
            workflowRun,
            actor,
            telemetry: platformRuntime.telemetry,
          });
        } else {
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
        const resumedWorkflowRun = await resumeRenderExecutionIfReady({
          store,
          schemaRegistry,
          workflowSpec,
          queueAdapter: platformRuntime.queueAdapter,
          renderExecutionService,
          workflowRun: rebuiltRun,
          actor,
          telemetry: platformRuntime.telemetry,
        });
        sendJson(response, 200, resumedWorkflowRun);
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
        const resumedWorkflowRun = await resumeRenderExecutionIfReady({
          store,
          schemaRegistry,
          workflowSpec,
          queueAdapter: platformRuntime.queueAdapter,
          renderExecutionService,
          workflowRun: updatedWorkflowRun,
          actor,
          telemetry: platformRuntime.telemetry,
        });

        sendJson(response, 200, resumedWorkflowRun);
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

        rebuildClinicalPackageForRun({
          store,
          schemaRegistry,
          workflowSpec,
          clinicalService,
          storyEngineService,
          workflowRun: matchingRun,
          actor,
          reason: `Recomputed the clinical package after contradiction resolution for ${contradictionResolutionPath.claimId}.`,
        });
        const refreshedWorkflowRun = store.getWorkflowRun(matchingRun.id);

        if (refreshedWorkflowRun) {
          await resumeRenderExecutionIfReady({
            store,
            schemaRegistry,
            workflowSpec,
            queueAdapter: platformRuntime.queueAdapter,
            renderExecutionService,
            workflowRun: refreshedWorkflowRun,
            actor,
            telemetry: platformRuntime.telemetry,
          });
        }

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
          supersededBy: typeof body.supersededBy === 'string' ? body.supersededBy : undefined,
        });

        rebuildClinicalPackageForRun({
          store,
          schemaRegistry,
          workflowSpec,
          clinicalService,
          storyEngineService,
          workflowRun: matchingRun,
          actor,
          reason: `Recomputed the clinical package after source governance for ${sourceGovernanceDecisionPath.sourceId}.`,
        });
        const refreshedWorkflowRun = store.getWorkflowRun(matchingRun.id);

        if (refreshedWorkflowRun) {
          await resumeRenderExecutionIfReady({
            store,
            schemaRegistry,
            workflowSpec,
            queueAdapter: platformRuntime.queueAdapter,
            renderExecutionService,
            workflowRun: refreshedWorkflowRun,
            actor,
            telemetry: platformRuntime.telemetry,
          });
        }

        sendJson(response, 201, governanceDecision);
        return;
      }

      if (method === 'GET' && isSourceCatalogPath(pathname)) {
        if (!canViewTenantData(actor)) {
          throw createHttpError(403, 'Actor cannot read source catalog data.');
        }

        const sourceCatalog = buildSourceCatalogPayload(store, clinicalService, actor.tenantId);
        sourceCatalog.forEach((sourceRecord) => assertSchema(schemaRegistry, 'contracts/source-record.schema.json', sourceRecord));
        sendJson(response, 200, sourceCatalog);
        return;
      }

      if (method === 'GET' && isSourceOpsPath(pathname)) {
        if (!canViewTenantData(actor)) {
          throw createHttpError(403, 'Actor cannot read source ops data.');
        }

        const sourceOpsView = buildSourceOpsView({
          store,
          clinicalService,
          tenantId: actor.tenantId,
          searchParams: requestUrl.searchParams,
        });
        assertSchema(schemaRegistry, 'contracts/source-ops-view.schema.json', sourceOpsView);
        sendJson(response, 200, sourceOpsView);
        return;
      }

      if (method === 'GET' && isSourceOpsCalendarPath(pathname)) {
        if (!canViewTenantData(actor)) {
          throw createHttpError(403, 'Actor cannot read source refresh calendar.');
        }

        const sourceRefreshCalendar = buildSourceRefreshCalendar({
          store,
          clinicalService,
          tenantId: actor.tenantId,
        });
        assertSchema(schemaRegistry, 'contracts/source-refresh-calendar.schema.json', sourceRefreshCalendar);
        sendJson(response, 200, sourceRefreshCalendar);
        return;
      }

      const sourceRefreshTaskPath = matchSourceRefreshTaskPath(pathname);

      if (sourceRefreshTaskPath && method === 'POST') {
        if (!canViewTenantData(actor)) {
          throw createHttpError(403, 'Actor cannot create source refresh tasks.');
        }

        const body = await readJsonBody(request);

        if (!isRecord(body) || typeof body.canonicalDiseaseName !== 'string') {
          throw createHttpError(400, 'canonicalDiseaseName is required.');
        }

        const sourceRecord = clinicalService.getSourceRecord(sourceRefreshTaskPath.sourceId, {
          governanceDecisions: listTenantGovernanceArtifacts(store, actor.tenantId, 'source-governance-decision'),
          contradictionResolutions: listTenantGovernanceArtifacts(store, actor.tenantId, 'contradiction-resolution'),
        });

        if (!sourceRecord || sourceRecord.canonicalDiseaseName !== body.canonicalDiseaseName) {
          throw createHttpError(404, 'Source record not found for the requested disease.');
        }

        const existingTask = listTenantArtifactsByType(store, 'source-refresh-task', actor.tenantId)
          .find((task) => task.sourceId === sourceRecord.id && task.canonicalDiseaseName === body.canonicalDiseaseName && task.status !== 'completed' && task.status !== 'cancelled')
          ?? null;
        const refreshTaskResult = saveSourceRefreshTask({
          store,
          schemaRegistry,
          actor,
          tenantId: actor.tenantId,
          workflowRunId: typeof body.workflowRunId === 'string' ? body.workflowRunId : undefined,
          sourceRecord,
          existingTask,
          reason: typeof body.reason === 'string' ? body.reason : undefined,
        });
        appendAuditLog(
          store,
          schemaRegistry,
          actor,
          'source-refresh-task.create',
          'source-record',
          sourceRecord.id,
          'success',
          `Created source refresh task ${refreshTaskResult.refreshTask.id}.`,
          {
            canonicalDiseaseName: body.canonicalDiseaseName,
            sourceRefreshTaskId: refreshTaskResult.refreshTask.id,
            workItemId: refreshTaskResult.workItem.id,
          },
        );
        sendJson(response, 201, refreshTaskResult.refreshTask);
        return;
      }

      const sourceOwnershipPath = matchSourceOwnershipPath(pathname);

      if (sourceOwnershipPath && method === 'POST') {
        if (!canViewTenantData(actor)) {
          throw createHttpError(403, 'Actor cannot assign source ownership.');
        }

        const body = await readJsonBody(request);

        if (
          !isRecord(body)
          || typeof body.canonicalDiseaseName !== 'string'
          || typeof body.primaryOwnerRole !== 'string'
          || typeof body.backupOwnerRole !== 'string'
        ) {
          throw createHttpError(400, 'canonicalDiseaseName, primaryOwnerRole, and backupOwnerRole are required.');
        }

        const sourceRecord = clinicalService.getSourceRecord(sourceOwnershipPath.sourceId, {
          governanceDecisions: listTenantGovernanceArtifacts(store, actor.tenantId, 'source-governance-decision'),
          contradictionResolutions: listTenantGovernanceArtifacts(store, actor.tenantId, 'contradiction-resolution'),
        });

        if (!sourceRecord || sourceRecord.canonicalDiseaseName !== body.canonicalDiseaseName) {
          throw createHttpError(404, 'Source record not found for the requested disease.');
        }

        const sourceOwnerAssignment = saveSourceOwnerAssignment({
          store,
          schemaRegistry,
          actor,
          tenantId: actor.tenantId,
          sourceId: sourceRecord.id,
          canonicalDiseaseName: body.canonicalDiseaseName,
          primaryOwnerRole: body.primaryOwnerRole,
          backupOwnerRole: body.backupOwnerRole,
          notes: Array.isArray(body.notes) ? body.notes.filter((value) => typeof value === 'string') : [],
        });
        appendAuditLog(
          store,
          schemaRegistry,
          actor,
          'source-owner-assignment.create',
          'source-record',
          sourceRecord.id,
          'success',
          `Assigned ${body.primaryOwnerRole} ownership for source ${sourceRecord.id}.`,
          {
            backupOwnerRole: body.backupOwnerRole,
            canonicalDiseaseName: body.canonicalDiseaseName,
            sourceOwnerAssignmentId: sourceOwnerAssignment.id,
          },
        );
        sendJson(response, 201, sourceOwnerAssignment);
        return;
      }

      const releaseBundlePath = matchReleaseBundlePath(pathname);
      const releaseBundleRenderingGuidePath = matchReleaseBundleRenderingGuidePath(pathname);
      const releaseBundleMirrorPath = matchReleaseBundleMirrorLocalPath(pathname);
      const releaseBundleVerifyMirrorPath = matchReleaseBundleVerifyLocalMirrorPath(pathname);

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

      if (method === 'POST' && releaseBundleMirrorPath) {
        const releaseBundle = store.getArtifact('release-bundle', releaseBundleMirrorPath.releaseId);

        if (!releaseBundle) {
          throw createHttpError(404, 'Release bundle not found.');
        }

        assertTenantAccess(actor, releaseBundle.tenantId, store, schemaRegistry, 'release-bundle.mirror-local', 'workflow-run', releaseBundle.workflowRunId);
        const deliveryMirror = await mirrorReleaseBundleLocally({
          store,
          schemaRegistry,
          actor,
          releaseBundle,
          rootDir,
        });
        sendJson(response, 201, deliveryMirror);
        return;
      }

      if (method === 'POST' && releaseBundleVerifyMirrorPath) {
        const releaseBundle = store.getArtifact('release-bundle', releaseBundleVerifyMirrorPath.releaseId);

        if (!releaseBundle) {
          throw createHttpError(404, 'Release bundle not found.');
        }

        assertTenantAccess(actor, releaseBundle.tenantId, store, schemaRegistry, 'release-bundle.verify-local-mirror', 'workflow-run', releaseBundle.workflowRunId);
        const deliveryVerification = await verifyLocalDeliveryMirror({
          store,
          schemaRegistry,
          actor,
          releaseBundle,
        });
        sendJson(response, 201, deliveryVerification);
        return;
      }

      if (method === 'GET' && releaseBundleRenderingGuidePath) {
        const releaseBundle = store.getArtifact('release-bundle', releaseBundleRenderingGuidePath.releaseId);

        if (!releaseBundle) {
          throw createHttpError(404, 'Release bundle not found.');
        }

        assertTenantAccess(actor, releaseBundle.tenantId, store, schemaRegistry, 'release-bundle.rendering-guide.view', 'workflow-run', releaseBundle.workflowRunId);

        if (!releaseBundle.renderingGuideMarkdownDocumentId) {
          throw createHttpError(404, 'Release bundle rendering guide not found.');
        }

        const renderingGuideMarkdown = store.getDocument('rendering-guide-markdown', releaseBundle.renderingGuideMarkdownDocumentId);

        if (!renderingGuideMarkdown) {
          throw createHttpError(404, 'Release bundle rendering guide markdown could not be loaded.');
        }

        response.statusCode = 200;
        response.setHeader('content-type', 'text/markdown; charset=utf-8');
        response.end(renderingGuideMarkdown);
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
