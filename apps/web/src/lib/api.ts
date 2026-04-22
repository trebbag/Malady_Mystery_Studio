import type {
  ArtifactDiffView,
  AuditLogEntry,
  ClinicalPackageView,
  EvalRun,
  ExportHistoryEntry,
  LocalRuntimeView,
  ReleaseBundle,
  ReviewAssignment,
  ReviewComment,
  ReviewDashboardView,
  ReviewRunView,
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

export function fetchWorkflowRun(runId: string) {
  return request<WorkflowRun>(`/api/v1/workflow-runs/${encodeURIComponent(runId)}`);
}

export function fetchReviewRunView(runId: string) {
  return request<ReviewRunView>(`/api/v1/workflow-runs/${encodeURIComponent(runId)}/review-run-view`);
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

export function fetchExports(runId: string) {
  return request<ExportHistoryEntry[]>(`/api/v1/workflow-runs/${encodeURIComponent(runId)}/exports`);
}

export function fetchReleaseBundle(releaseId: string) {
  return request<ReleaseBundle>(`/api/v1/release-bundles/${encodeURIComponent(releaseId)}`);
}

export function fetchSourceRecords(canonicalDiseaseName: string) {
  return request<Array<Record<string, unknown>>>(
    `/api/v1/source-records?canonicalDiseaseName=${encodeURIComponent(canonicalDiseaseName)}`,
  );
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
