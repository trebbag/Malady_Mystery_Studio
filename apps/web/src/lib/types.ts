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

export interface ReviewQueueAnalyticsView {
  schemaVersion: string;
  summary: {
    totalItemCount: number;
    overdueItemCount: number;
    escalatedItemCount: number;
    overdueRate: number;
    escalationRate: number;
    medianAgeHours: number;
    dueSoonItemCount: number;
    completedItemCount: number;
    fallbackQueueItemCount: number;
    unreadNotificationCount: number;
    unresolvedMentionCount: number;
    sourceRefreshOpenCount: number;
    renderRetryOpenCount: number;
    opsDrillOpenCount: number;
    medianThreadResolutionHours: number;
  };
  countsByWorkType: Array<{ workType: string; count: number }>;
  countsByStatus: Array<{ status: string; count: number }>;
  countsByPriority: Array<{ priority: string; count: number }>;
  assigneeLoad: Array<{ assignee: string; count: number }>;
  runBlockersByStage: Array<{ stage: string; count: number }>;
  overdueAgingBuckets: Array<{ bucket: string; count: number }>;
  slaBuckets: Array<{ bucket: string; count: number }>;
  sourceRefreshBurden: Array<{ canonicalDiseaseName: string; ownerRole: string; openCount: number; overdueCount: number }>;
  threadResolution: {
    openThreadCount: number;
    resolvedThreadCount: number;
    medianResolutionHours: number;
  };
}

export interface ReviewQueueAnalyticsSnapshot {
  schemaVersion: string;
  id: string;
  tenantId: string;
  snapshotLabel: string;
  analytics: ReviewQueueAnalyticsView;
  createdBy: string;
  createdAt: string;
}

export interface Notification {
  schemaVersion: string;
  id: string;
  tenantId: string;
  targetActorId?: string;
  workflowRunId?: string;
  threadId?: string;
  workItemId?: string;
  notificationType: 'mention' | 'assignment' | 'due-soon' | 'overdue' | 'promotion-ready' | 'source-refresh';
  status: 'unread' | 'read' | 'archived';
  message: string;
  subjectType?: string;
  subjectId?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  readAt?: string;
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
  mentionedActorIds?: string[];
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
  unreadCount?: number;
  latestMessagePreview?: string;
  latestMessageAt?: string;
  openActionCount?: number;
  linkedWorkItemIds?: string[];
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
  startedAt?: string;
  activeRenderPromptId?: string;
  completedRenderPromptIds?: string[];
  completedRenderCount?: number;
  totalRenderCount?: number;
  lastError?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface RenderingGuide {
  id: string;
  workflowRunId: string;
  tenantId: string;
  projectTitle: string;
  canonicalDiseaseName: string;
  providerTargets: string[];
  generatedAt: string;
  markdownDocumentId: string;
  markdownLocation: string;
  visualReferencePackId?: string;
  reviewStatus?: 'not-reviewed' | 'approved' | 'changes-requested' | 'rejected' | 'stale';
  referenceCoverageSummary?: Record<string, unknown>;
  runSummary: Record<string, unknown>;
  franchiseRules: string[];
  continuityBible: Record<string, unknown>;
  panelExecutionStrategy?: {
    sequentialPanelExecutionRecommended: boolean;
    continuityReferenceRequired: boolean;
    separateLetteringRequired: boolean;
    manualReviewRequired: boolean;
  };
  globalNegativeConstraints: string[];
  openAiPanelExecutionPrompt?: string;
  retryGuidance: string[];
  panels: Array<Record<string, unknown>>;
}

export interface VisualReferenceItem {
  id: string;
  itemType: 'character' | 'prop' | 'set-piece' | 'anatomy-environment' | 'style-frame';
  canonicalName: string;
  description?: string;
  source: string;
  approvalStatus: string;
  usagePanelIds: string[];
  imageReferenceLocations?: string[];
  textLocks: string[];
  personalityLocks?: string[];
  continuityLocks?: string[];
  styleLocks: string[];
  negativeLocks: string[];
}

export interface VisualReferencePack {
  id: string;
  workflowRunId: string;
  tenantId: string;
  renderingGuideId: string;
  generatedAt: string;
  approvalStatus: 'not-reviewed' | 'approved' | 'changes-requested' | 'rejected' | 'stale';
  requiredBeforeRender: boolean;
  items: VisualReferenceItem[];
  panelReferenceMap: Array<{
    panelId: string;
    visualReferenceItemIds: string[];
  }>;
  coverageSummary: {
    panelCount: number;
    panelsWithReferenceItems: number;
    missingPanelReferenceCount: number;
    requiredCharacterItems: number;
    presentCharacterItems: number;
    recurringItemCount: number;
    warnings: string[];
  };
}

export interface RenderGuideReviewDecision {
  id: string;
  workflowRunId: string;
  tenantId: string;
  renderingGuideId: string;
  visualReferencePackId: string;
  decision: 'approved' | 'changes-requested' | 'rejected';
  reviewerId: string;
  reviewerRoles: string[];
  comment?: string;
  requiredChanges?: string[];
  createdAt: string;
}

export interface RenderingGuideView {
  schemaVersion: string;
  runId: string;
  renderingGuide: RenderingGuide;
  markdown: string;
  attachmentSummary: {
    attachedRenderedAssetCount: number;
    latestRenderedAssetManifestId?: string;
    attachmentMode: 'guide-only' | 'external-art-attached';
  };
  visualReferencePack: VisualReferencePack | null;
  reviewDecision: RenderGuideReviewDecision | null;
  gateStatus: 'not-reviewed' | 'approved' | 'changes-requested' | 'rejected' | 'stale' | 'missing-guide' | 'missing-reference-pack';
  renderDisabledReason: string;
  guideWarnings: string[];
  availableActions: string[];
}

export interface RenderedAssetAttachmentRequest {
  assets: Array<{
    panelId: string;
    renderPromptId?: string;
    location: string;
    mimeType: string;
    checksum: string;
    thumbnailLocation?: string;
    width?: number;
    height?: number;
  }>;
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
  renderingGuide?: RenderingGuide;
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
    dueSoonItemCount: number;
    fallbackQueueItemCount: number;
    unreadNotificationCount: number;
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
    reminderDue?: boolean;
    escalationTargetQueue?: string;
    threadCount?: number;
    latestThreadStatus?: string;
    notificationCount?: number;
    unreadNotificationCount?: number;
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
    runtimeMode: 'local' | 'managed';
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
  localStoragePolicy: {
    mode: 'local-only';
    filesStayLocal: true;
    filesPersistedInPostgres: false;
    metadataStore: 'sqlite';
    objectStore: 'filesystem';
    dbFilePath: string;
    objectStoreDir: string;
    postgresUsage: string;
    managedObjectStorageUsage: string;
    backupCommand: string;
    restoreCommand: string;
    resetCommand: string;
    notes: string[];
  };
  externalElements?: {
    clinicalEducationCompatibility: {
      enabled: boolean;
      sourceProjectLabel: string;
    };
    openAi: {
      apiKeyConfigured: boolean;
      knowledgeBaseVectorStoreConfigured: boolean;
      researchModel: string;
      renderModel: string;
      renderProvider: string;
    };
    canon: {
      autoDiscoveryEnabled: boolean;
      root: string;
      characterBiblePath: string;
      seriesStyleBiblePath: string;
      deckSpecPath: string;
      episodeMemoryPath: string;
    };
    pipeline: {
      mode: string;
      maxConcurrentRuns: number;
      retentionKeepLast: number;
      fakeStepDelayMs: number;
      kb0TimeoutMs: number;
      stepAbAgentTimeoutMs: number;
      stepCAgentTimeoutMs: number;
      stepCDeckSpecTimeoutMs: number;
      agentIsolationMode: string;
    };
  };
}

export interface RestoreSmokeResult {
  schemaVersion: string;
  id: string;
  tenantId: string;
  status: 'passed' | 'failed';
  mode: 'local-filesystem';
  backupDir: string;
  scratchDir: string;
  checks: Array<{ name: string; status: 'passed' | 'failed' | 'warning'; details?: string }>;
  stats: {
    dbFileCopied: boolean;
    objectCount: number;
    byteLength: number;
    releaseBundleCount: number;
    renderedManifestCount: number;
    schemaValidatedArtifactCount: number;
    schemaValidationFailureCount: number;
    objectReferenceCount: number;
    missingObjectReferenceCount: number;
    deliveryVerificationCount: number;
    failedDeliveryVerificationCount: number;
  };
  createdBy: string;
  startedAt: string;
  completedAt: string;
}

export interface LocalDeliveryMirror {
  schemaVersion: string;
  id: string;
  tenantId: string;
  releaseId: string;
  workflowRunId: string;
  status: 'mirrored' | 'partial' | 'failed';
  deliveryDir: string;
  files: Array<{ label: string; path: string; checksum: string; byteLength: number }>;
  warnings?: string[];
  checksumManifestLocation: string;
  createdBy: string;
  createdAt: string;
}

export interface LocalDeliveryVerification {
  schemaVersion: string;
  id: string;
  tenantId: string;
  releaseId: string;
  workflowRunId: string;
  localDeliveryMirrorId: string;
  status: 'passed' | 'failed';
  deliveryDir: string;
  checks: Array<{ name: string; status: 'passed' | 'failed' | 'warning'; details?: string }>;
  verifiedFileCount: number;
  failedFileCount: number;
  checksumManifestLocation: string;
  createdBy: string;
  createdAt: string;
}

export interface LocalOpsStatus {
  schemaVersion: string;
  tenantId: string;
  storage: {
    mode: 'local-only';
    dbFilePath: string;
    objectStoreDir: string;
    backupRootDir: string;
    deliveryRootDir: string;
    objectCount: number;
    byteLength: number;
  };
  latestBackup: null | { path: string; createdAt: string };
  latestRestoreSmoke: RestoreSmokeResult | null;
  latestDeliveryMirror: LocalDeliveryMirror | null;
  latestDeliveryVerification: LocalDeliveryVerification | null;
  opsDrillWorkItems: WorkItem[];
  generatedAt: string;
}

export interface SourceRefreshCalendar {
  schemaVersion: string;
  tenantId: string;
  generatedAt: string;
  summary: {
    totalSourceCount: number;
    dueSoonCount: number;
    overdueCount: number;
    ownerlessCount: number;
    openRefreshWorkCount: number;
  };
  items: Array<{
    sourceId: string;
    sourceLabel: string;
    canonicalDiseaseName: string;
    primaryOwnerRole: string;
    backupOwnerRole: string;
    freshnessState: string;
    nextReviewDueAt: string;
    daysUntilDue: number;
    bucket: 'overdue' | 'due-30-days' | 'due-90-days' | 'future' | 'ownerless' | 'blocked';
    openRefreshWorkItemIds: string[];
  }>;
}

export interface SourceOpsView {
  schemaVersion: string;
  filters: {
    disease: string;
    freshnessState: string;
    approvalStatus: string;
    ownerRole: string;
    openRefreshOnly: boolean;
  };
  summary: {
    visibleSourceCount: number;
    staleSourceCount: number;
    blockedSourceCount: number;
    suspendedSourceCount: number;
    ownerlessSourceCount: number;
    openRefreshTaskCount: number;
    impactedRunCount: number;
    promotedDiseaseCount: number;
  };
  sourceRecords: Array<Record<string, unknown>>;
  refreshTasks: Array<Record<string, unknown>>;
  workItems: WorkItem[];
}

export interface RenderedPanelQaDecision {
  schemaVersion: string;
  id: string;
  tenantId: string;
  workflowRunId: string;
  renderedAssetManifestId: string;
  renderJobId?: string;
  decision: 'approved' | 'changes-requested' | 'rejected' | 'structural-only';
  checklist: {
    cytoConsistency: boolean;
    pipConsistency: boolean;
    styleConsistency: boolean;
    anatomyFidelity: boolean;
    setPieceContinuity: boolean;
    letteringSeparation: boolean;
    noVisibleText: boolean;
    panelOrder: boolean;
    guideProvenance: boolean;
  };
  notes?: string;
  reviewerId: string;
  reviewerRoles: string[];
  createdAt: string;
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
  renderingGuideId?: string;
  renderingGuideLocation?: string;
  renderingGuideMarkdownDocumentId?: string;
  renderingGuideMarkdownLocation?: string;
  renderedAssetManifestId?: string;
  renderedAssetManifestLocation?: string;
  qualitySummary?: Record<string, unknown>;
  gateChecks?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}
