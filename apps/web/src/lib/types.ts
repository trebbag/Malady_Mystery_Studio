export interface DashboardRun {
  runId: string;
  projectTitle: string;
  diseaseName: string;
  state: string;
  currentStage: string;
  pauseReason?: string;
  latestEvalStatus: string;
  exportCount: number;
  updatedAt: string;
}

export interface ReviewDashboardView {
  schemaVersion: string;
  title: string;
  filters: {
    disease: string;
    state: string;
    stage: string;
    exportStatus: string;
    evalStatus: string;
    sort: string;
  };
  stats: {
    visibleRunCount: number;
    blockedClinicalRunCount: number;
    awaitingReviewCount: number;
    staleEvalCount: number;
    exportReadyCount: number;
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
  evaluationSummary: EvaluationSummaryView;
  exportHistory: ExportHistoryView;
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
  qualitySummary?: Record<string, unknown>;
  gateChecks?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}
