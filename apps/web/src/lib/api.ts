import type {
  ArtifactDiffView,
  AuditLogEntry,
  ClinicalPackageView,
  EvalRun,
  ExportHistoryEntry,
  LocalRuntimeView,
  Notification,
  RenderedAssetAttachmentRequest,
  RenderingGuideView,
  ReviewMessage,
  ReviewQueueAnalyticsView,
  ReviewQueueView,
  ReleaseBundle,
  ReviewAssignment,
  ReviewComment,
  ReviewDashboardView,
  ReviewRunView,
  ReviewThread,
  RenderJob,
  WorkItem,
  WorkflowArtifactListView,
  WorkflowRun,
} from './types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

function toUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

async function readJson<T>(response: Response) {
  return response.json() as Promise<T>;
}

async function request<T>(path: string, init?: RequestInit) {
  const response = await fetch(toUrl(path), {
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    let details: unknown;

    try {
      const payload = await response.json() as { error?: string; details?: unknown };
      message = payload.error ?? message;
      details = payload.details;
    } catch {
      // Ignore JSON parse failures for plain-text responses.
    }

    throw new ApiError(message, response.status, details);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return readJson<T>(response);
}

function buildQuery(params: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value && value.trim().length > 0) {
      searchParams.set(key, value);
    }
  });

  const encoded = searchParams.toString();
  return encoded ? `?${encoded}` : '';
}

export function fetchDashboardView(filters: Partial<ReviewDashboardView['filters']> = {}) {
  return request<ReviewDashboardView>(`/api/v1/review-dashboard-view${buildQuery(filters)}`);
}

export function fetchReviewQueue(filters: Partial<ReviewQueueView['filters']> = {}) {
  return request<ReviewQueueView>(`/api/v1/review-queue${buildQuery(filters)}`);
}

export function fetchReviewQueueAnalytics() {
  return request<ReviewQueueAnalyticsView>('/api/v1/review-queue/analytics');
}

export function fetchNotifications() {
  return request<Notification[]>('/api/v1/notifications');
}

export function updateNotification(notificationId: string, payload: Record<string, unknown>) {
  return request<Notification>(`/api/v1/notifications/${encodeURIComponent(notificationId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function fetchWorkflowRun(runId: string) {
  return request<WorkflowRun>(`/api/v1/workflow-runs/${encodeURIComponent(runId)}`);
}

export function fetchReviewRunView(runId: string) {
  return request<ReviewRunView>(`/api/v1/workflow-runs/${encodeURIComponent(runId)}/review-run-view`);
}

export function fetchRenderingGuideView(runId: string) {
  return request<RenderingGuideView>(`/api/v1/workflow-runs/${encodeURIComponent(runId)}/rendering-guide`);
}

export function fetchResearchBrief(runId: string) {
  return request<Record<string, unknown>>(`/api/v1/workflow-runs/${encodeURIComponent(runId)}/research-brief`);
}

export function fetchKnowledgePackBuildReport(runId: string) {
  return request<Record<string, unknown>>(`/api/v1/workflow-runs/${encodeURIComponent(runId)}/knowledge-pack-build-report`);
}

export function regenerateKnowledgePack(runId: string) {
  return request<WorkflowRun>(`/api/v1/workflow-runs/${encodeURIComponent(runId)}/knowledge-pack/regenerate`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function approveKnowledgePack(runId: string, payload: Record<string, unknown> = {}) {
  return request<WorkflowRun>(`/api/v1/workflow-runs/${encodeURIComponent(runId)}/knowledge-pack/approve`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function promoteKnowledgePack(runId: string, payload: Record<string, unknown> = {}) {
  return request<WorkflowRun>(`/api/v1/workflow-runs/${encodeURIComponent(runId)}/knowledge-pack/promote`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function regenerateRenderingGuide(runId: string) {
  return request<RenderingGuideView>(`/api/v1/workflow-runs/${encodeURIComponent(runId)}/rendering-guide/regenerate`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function attachRenderedAssets(runId: string, payload: RenderedAssetAttachmentRequest) {
  return request<RenderingGuideView>(`/api/v1/workflow-runs/${encodeURIComponent(runId)}/rendered-assets/attach`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchClinicalPackage(runId: string) {
  return request<ClinicalPackageView>(`/api/v1/workflow-runs/${encodeURIComponent(runId)}/clinical-package`);
}

export function fetchWorkflowArtifacts(runId: string, artifactTypes: string[] = [], expand = false) {
  const searchParams = new URLSearchParams();

  artifactTypes.forEach((artifactType) => {
    searchParams.append('artifactType', artifactType);
  });
  searchParams.set('expand', expand ? 'true' : 'false');

  return request<WorkflowArtifactListView>(
    `/api/v1/workflow-runs/${encodeURIComponent(runId)}/artifacts?${searchParams.toString()}`,
  );
}

export function fetchReviewComments(runId: string) {
  return request<ReviewComment[]>(`/api/v1/workflow-runs/${encodeURIComponent(runId)}/comments`);
}

export function createReviewComment(runId: string, payload: Record<string, unknown>) {
  return request<ReviewComment>(`/api/v1/workflow-runs/${encodeURIComponent(runId)}/comments`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchReviewAssignments(runId: string) {
  return request<ReviewAssignment[]>(`/api/v1/workflow-runs/${encodeURIComponent(runId)}/assignments`);
}

export function fetchReviewThreads(runId: string) {
  return request<ReviewThread[]>(`/api/v1/workflow-runs/${encodeURIComponent(runId)}/threads`);
}

export function createReviewThread(runId: string, payload: Record<string, unknown>) {
  return request<ReviewThread>(`/api/v1/workflow-runs/${encodeURIComponent(runId)}/threads`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchThreadMessages(threadId: string) {
  return request<ReviewMessage[]>(`/api/v1/review-threads/${encodeURIComponent(threadId)}/messages`);
}

export function createThreadMessage(threadId: string, payload: Record<string, unknown>) {
  return request<ReviewMessage>(`/api/v1/review-threads/${encodeURIComponent(threadId)}/messages`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchWorkItem(workItemId: string) {
  return request<WorkItem>(`/api/v1/work-items/${encodeURIComponent(workItemId)}`);
}

export function updateWorkItem(workItemId: string, payload: Record<string, unknown>) {
  return request<WorkItem>(`/api/v1/work-items/${encodeURIComponent(workItemId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function createReviewAssignment(runId: string, payload: Record<string, unknown>) {
  return request<ReviewAssignment>(`/api/v1/workflow-runs/${encodeURIComponent(runId)}/assignments`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchArtifactDiff(
  runId: string,
  artifactType: string,
  options: { leftArtifactId?: string; rightArtifactId?: string } = {},
) {
  return request<ArtifactDiffView>(
    `/api/v1/workflow-runs/${encodeURIComponent(runId)}/artifact-diffs${buildQuery({
      artifactType,
      leftArtifactId: options.leftArtifactId,
      rightArtifactId: options.rightArtifactId,
    })}`,
  );
}

export function fetchAuditLogEntries(runId: string) {
  return request<AuditLogEntry[]>(`/api/v1/workflow-runs/${encodeURIComponent(runId)}/audit-log-entries`);
}

export function fetchEvaluations(runId: string) {
  return request<EvalRun[]>(`/api/v1/workflow-runs/${encodeURIComponent(runId)}/evaluations`);
}

export function createRenderJob(runId: string, payload: Record<string, unknown> = {}) {
  return request<{ workflowRun: WorkflowRun; renderJob: RenderJob }>(
    `/api/v1/workflow-runs/${encodeURIComponent(runId)}/render-jobs`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export function fetchRenderJob(jobId: string) {
  return request<RenderJob & { attempts?: Array<Record<string, unknown>>; renderedAssets?: Array<Record<string, unknown>>; renderedAssetManifest?: Record<string, unknown> | null }>(
    `/api/v1/render-jobs/${encodeURIComponent(jobId)}`,
  );
}

export function retryRenderJob(jobId: string) {
  return request<{ workflowRun: WorkflowRun; renderJob: RenderJob }>(
    `/api/v1/render-jobs/${encodeURIComponent(jobId)}/retry`,
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
  );
}

export function fetchExports(runId: string) {
  return request<ExportHistoryEntry[]>(`/api/v1/workflow-runs/${encodeURIComponent(runId)}/exports`);
}

export function fetchReleaseBundle(releaseId: string) {
  return request<ReleaseBundle>(`/api/v1/release-bundles/${encodeURIComponent(releaseId)}`);
}

export function getReleaseBundleRenderingGuideUrl(releaseId: string) {
  return toUrl(`/api/v1/release-bundles/${encodeURIComponent(releaseId)}/rendering-guide`);
}

export function fetchSourceRecords(canonicalDiseaseName: string) {
  return request<Array<Record<string, unknown>>>(
    `/api/v1/source-records?canonicalDiseaseName=${encodeURIComponent(canonicalDiseaseName)}`,
  );
}

export function fetchSourceCatalog() {
  return request<Array<Record<string, unknown>>>('/api/v1/source-catalog');
}

export function fetchLocalRuntimeView() {
  return request<LocalRuntimeView>('/api/v1/local-runtime-view');
}

export function createProject(payload: Record<string, unknown>) {
  return request<{ id: string; title: string; input: { diseaseName: string } }>(
    '/api/v1/projects',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export function startWorkflowRun(payload: Record<string, unknown>) {
  return request<WorkflowRun>('/api/v1/workflow-runs', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function submitApproval(runId: string, payload: Record<string, unknown>) {
  return request<WorkflowRun>(`/api/v1/workflow-runs/${encodeURIComponent(runId)}/approvals`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function resolveCanonicalization(runId: string, payload: Record<string, unknown>) {
  return request<WorkflowRun>(
    `/api/v1/workflow-runs/${encodeURIComponent(runId)}/canonicalization-resolution`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export function rebuildClinicalPackage(runId: string, payload: Record<string, unknown>) {
  return request<WorkflowRun>(
    `/api/v1/workflow-runs/${encodeURIComponent(runId)}/clinical-package/rebuild`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export function recordSourceDecision(sourceId: string, payload: Record<string, unknown>) {
  return request<Record<string, unknown>>(
    `/api/v1/source-records/${encodeURIComponent(sourceId)}/governance-decisions`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export function createSourceRefreshTask(sourceId: string, payload: Record<string, unknown>) {
  return request<Record<string, unknown>>(
    `/api/v1/source-catalog/${encodeURIComponent(sourceId)}/refresh-tasks`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export function assignSourceOwnership(sourceId: string, payload: Record<string, unknown>) {
  return request<Record<string, unknown>>(
    `/api/v1/source-catalog/${encodeURIComponent(sourceId)}/ownership`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export function recordContradictionResolution(claimId: string, payload: Record<string, unknown>) {
  return request<Record<string, unknown>>(
    `/api/v1/evidence-records/${encodeURIComponent(claimId)}/contradiction-resolutions`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export function runEvaluations(runId: string) {
  return request<{ workflowRun: WorkflowRun; evaluation: EvalRun }>(
    `/api/v1/workflow-runs/${encodeURIComponent(runId)}/evaluations`,
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
  );
}

export function exportBundle(runId: string, payload: Record<string, unknown>) {
  return request<{ workflowRun: WorkflowRun; releaseBundle: ReleaseBundle; exportHistoryEntry: ExportHistoryEntry }>(
    `/api/v1/workflow-runs/${encodeURIComponent(runId)}/exports`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}
