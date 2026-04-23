export interface DashboardRun {
  runId: string;
  projectTitle: string;
  diseaseName: string;
  state: string;
  currentStage: string;
  assignees: string[];
  openCommentCount: number;
  pauseReason?: string;
  latestEvalStatus: string;
  exportCount: number;
  activeWorkItemCount: number;
  overdueWorkItemCount: number;
  threadCount: number;
  updatedAt: string;
}

export interface ReviewDashboardView {
  schemaVersion: string;
  title: string;
  filters: {
    disease: string;
    state: string;
    stage: string;
    assignee: string;
    exportStatus: string;
    evalStatus: string;
    queueStatus: string;
    workType: string;
    sort: string;
  };
  stats: {
    visibleRunCount: number;
    blockedClinicalRunCount: number;
    awaitingReviewCount: number;
    assignedRunCount: number;
    openCommentCount: number;
    staleEvalCount: number;
    exportReadyCount: number;
    overdueWorkItemCount: number;
    escalatedWorkItemCount: number;
  };
  runs: DashboardRun[];
}

export interface WorkflowStage {
  name: string;
  status: string;
  notes?: string;
}

export interface WorkflowArtifactReference {
  artifactType: string;
  artifactId: string;
  status: string;
  path?: string;
}

export interface WorkflowApproval {
  role: string;
  decision: string;
  reviewerId?: string;
  comment?: string;
}

export interface WorkflowRun {
  id: string;
  projectId: string;
  state: string;
  currentStage: string;
  pauseReason?: string;
  createdAt: string;
  updatedAt: string;
  input: {
    diseaseName: string;
    audienceTier?: string;
    lengthProfile?: string;
    qualityProfile?: string;
    styleProfile?: string;
  };
  stages: WorkflowStage[];
  artifacts: WorkflowArtifactReference[];
  approvals: WorkflowApproval[];
  requiredApprovalRoles: string[];
  latestEvalStatus?: string;
  latestEvalRunId?: string | null;
  latestEvalAt?: string | null;
}

export interface EvaluationFamilyResult {
  family: string;
  status: string;
  score?: number;
  threshold?: number;
  releaseGate?: string;
  blockingIssues?: string[];
}

export interface EvaluationSummaryView {
  schemaVersion: string;
  latestEvalRunId?: string;
  latestEvalStatus: string;
  evaluatedAt?: string;
  allThresholdsMet?: boolean;
  familyStatuses: EvaluationFamilyResult[];
}

export interface ExportHistoryEntry {
  id: string;
  releaseId: string;
  workflowRunId: string;
  status: string;
  exportedAt: string;
  bundleLocation?: string;
  bundleIndexLocation?: string;
  evalRunId?: string;
  [key: string]: unknown;
}

export interface ExportHistoryView {
  schemaVersion: string;
  runId: string;
  entries: ExportHistoryEntry[];
}

export interface TraceCoverageSummary {
  score: number;
  verdict: string;
  validClaimCount: number;
  suspendedSourceCount: number;
  staleSourceCount: number;
  blockingContradictions: number;
  artifactSummaries: Array<Record<string, unknown>>;
  blockers: string[];
}

export interface ClinicalPackageView {
  schemaVersion: string;
  runId: string;
  canonicalDisease: Record<string, unknown>;
  diseasePacket: Record<string, unknown>;
  factTable: Record<string, unknown>;
  evidenceGraph: Record<string, unknown>;
  clinicalTeachingPoints: Record<string, unknown>;
  visualAnchorCatalog: Record<string, unknown>;
  sourceGovernance: {
    canonicalDiseaseName: string;
    sourceRecords: Array<Record<string, unknown>>;
    governanceDecisions: Array<Record<string, unknown>>;
  };
  contradictionResolutions: Array<Record<string, unknown>>;
  traceCoverage: TraceCoverageSummary;
}

export interface ReviewComment {
  schemaVersion: string;
  id: string;
  tenantId: string;
  workflowRunId: string;
  scopeType: 'run' | 'artifact';
  artifactType?: string;
  artifactId?: string;
  fieldPath?: string;
  status: 'open' | 'resolved' | 'note';
  severity: 'info' | 'warning' | 'critical';
  body: string;
  reviewerId: string;
  reviewerDisplayName: string;
  reviewerRoles: string[];
  tags?: string[];
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface ReviewAssignment {
  schemaVersion: string;
  id: string;
  tenantId: string;
  workflowRunId: string;
  reviewRole: string;
  assigneeId: string;
  assigneeDisplayName: string;
  assigneeRoles: string[];
  status: 'queued' | 'in-progress' | 'completed' | 'reassigned';
  dueAt?: string;
  completedAt?: string;
  notes?: string;
  assignedBy: string;
  assignedByRoles: string[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkItem {
  schemaVersion: string;
  id: string;
  tenantId: string;
  workflowRunId?: string;
  workType: 'run-review' | 'source-refresh' | 'contradiction-resolution' | 'render-retry' | 'ops-drill';
  status: 'queued' | 'in-progress' | 'completed' | 'escalated' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  queueName: string;
  fallbackQueueName?: string;
  subjectType: string;
  subjectId: string;
  originType?: string;
  originId?: string;
  assignedActorId?: string;
  assignedActorDisplayName?: string;
  assignedActorRoles?: string[];
  slaHours: number;
  reminderAt?: string;
  dueAt: string;
  escalatedAt?: string;
  completedAt?: string;
  notes?: string[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewMessage {
  schemaVersion: string;
  id: string;
  threadId: string;
  tenantId: string;
  workflowRunId: string;
  parentMessageId?: string;
  authorId: string;
  authorDisplayName: string;
  body: string;
  mentions?: string[];
  status: 'posted' | 'edited' | 'resolved';
  resolutionNote?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

export interface ReviewThread {
  schemaVersion: string;
  id: string;
  tenantId: string;
  workflowRunId: string;
  scopeType: 'run' | 'stage' | 'artifact' | 'source' | 'render-job';
  scopeId?: string;
  title: string;
  status: 'open' | 'resolved' | 'archived';
  participantIds?: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  messages?: ReviewMessage[];
}

export interface RenderJob {
  schemaVersion: string;
  id: string;
  tenantId: string;
  workflowRunId: string;
  status: 'queued' | 'running' | 'completed' | 'retry-required' | 'failed';
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  queueName: string;
  provider: string;
  model: string;
  renderTargetProfileId: string;
  renderPromptIds: string[];
  attemptIds?: string[];
  renderedAssetManifestId?: string;
  lastError?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface ReviewRunView {
  schemaVersion: string;
  runId: string;
  projectTitle: string;
  diseaseName: string;
  state: string;
  currentStage: string;
  pauseReason?: string;
  stageTimeline: WorkflowStage[];
  clinicalPackage: ClinicalPackageView;
  reviewAssignments: ReviewAssignment[];
  reviewComments: ReviewComment[];
  workItems: WorkItem[];
  reviewThreads: ReviewThread[];
  evaluationSummary: EvaluationSummaryView;
  exportHistory: ExportHistoryView;
  renderJobs?: RenderJob[];
  availableActions: string[];
}

export interface WorkflowArtifactListView {
  schemaVersion: string;
  runId: string;
  artifactTypeFilters?: string[];
  expand: boolean;
  artifacts: Array<{
    artifactType: string;
    artifactId: string;
    status: string;
    path?: string;
    payload?: Record<string, unknown>;
  }>;
}

export interface ArtifactDiffChange {
  path: string;
  changeType: 'added' | 'removed' | 'changed';
  before?: unknown;
  after?: unknown;
}

export interface ArtifactDiffView {
  schemaVersion: string;
  runId: string;
  artifactType: string;
  comparisonStatus: 'diff-available' | 'insufficient-history';
  leftArtifactId?: string;
  rightArtifactId?: string;
  leftCreatedAt?: string;
  rightCreatedAt?: string;
  comparedAt?: string;
  availableArtifacts: Array<{
    artifactId: string;
    createdAt: string;
    status: string;
    path?: string;
  }>;
  summary: {
    changeCount: number;
    addedCount: number;
    removedCount: number;
    changedCount: number;
  };
  changes: ArtifactDiffChange[];
}

export interface EvalRun {
  id: string;
  workflowRunId: string;
  evaluatedAt: string;
  summary: {
    allThresholdsMet: boolean;
    [key: string]: unknown;
  };
  familyResults: EvaluationFamilyResult[];
  [key: string]: unknown;
}

export interface ReviewQueueView {
  schemaVersion: string;
  filters: {
    workType: string;
    status: string;
    priority: string;
    queueName: string;
    assignee: string;
  };
  stats: {
    visibleItemCount: number;
    overdueItemCount: number;
    escalatedItemCount: number;
    renderRetryCount: number;
    sourceRefreshCount: number;
  };
  items: Array<{
    workItemId: string;
    workflowRunId: string;
    projectTitle?: string;
    diseaseName: string;
    workType: string;
    status: string;
    priority: string;
    queueName: string;
    subjectType: string;
    subjectId: string;
    assignedActorDisplayName?: string;
    dueAt: string;
    reminderAt?: string;
    isOverdue: boolean;
    threadCount?: number;
    notes?: string[];
  }>;
}

export interface LocalRuntimeView {
  schemaVersion: string;
  actor: {
    id: string;
    displayName: string;
    roles: string[];
  };
  tenantId: string;
  serverBaseUrl: string;
  storage: {
    dbFilePath: string;
    objectStoreDir: string;
  };
  platform: {
    metadataStore: string;
    objectStore: string;
    queueBackend: string;
    telemetryBackend: string;
  };
  availableCommands: string[];
  readiness: {
    areas: Array<{
      label: string;
      percentComplete: number;
    }>;
    overall: {
      localMvpReadiness: number;
      pilotReadiness: number;
    };
    remainingWork: string[];
  };
}

export interface AuditLogEntry {
  id: string;
  action: string;
  subjectType: string;
  subjectId: string;
  outcome: string;
  occurredAt: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface ReleaseBundle {
  releaseId: string;
  version: string;
  bundleIndexLocation?: string;
  sourceEvidencePackLocation?: string;
  renderedAssetManifestId?: string;
  renderedAssetManifestLocation?: string;
  qualitySummary?: Record<string, unknown>;
  gateChecks?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}
