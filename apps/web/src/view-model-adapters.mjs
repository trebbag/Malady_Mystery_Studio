const SCHEMA_VERSION = '1.0.0';

/**
 * @param {any} traceCoverage
 * @returns {any}
 */
export function createTraceCoverageView(traceCoverage) {
  return {
    schemaVersion: SCHEMA_VERSION,
    score: traceCoverage?.score ?? 0,
    verdict: traceCoverage?.verdict ?? 'failed',
    validClaimCount: traceCoverage?.validClaimCount ?? 0,
    suspendedSourceCount: traceCoverage?.suspendedSourceCount ?? 0,
    staleSourceCount: traceCoverage?.staleSourceCount ?? 0,
    blockingContradictions: traceCoverage?.blockingContradictions ?? 0,
    artifactSummaries: traceCoverage?.artifactSummaries ?? [],
    blockers: traceCoverage?.blockers ?? [],
  };
}

/**
 * @param {{ canonicalDiseaseName: string, sourceRecords?: any[], governanceDecisions?: any[] }} options
 * @returns {any}
 */
export function createSourceGovernanceView(options) {
  return {
    schemaVersion: SCHEMA_VERSION,
    canonicalDiseaseName: options.canonicalDiseaseName,
    sourceRecords: options.sourceRecords ?? [],
    governanceDecisions: options.governanceDecisions ?? [],
  };
}

/**
 * @param {{ runId: string, clinicalPackage: any }} options
 * @returns {any}
 */
export function createClinicalPackageView(options) {
  return {
    schemaVersion: SCHEMA_VERSION,
    runId: options.runId,
    canonicalDisease: options.clinicalPackage.canonicalDisease,
    diseasePacket: options.clinicalPackage.diseasePacket,
    factTable: options.clinicalPackage.factTable,
    evidenceGraph: options.clinicalPackage.evidenceGraph,
    clinicalTeachingPoints: options.clinicalPackage.clinicalTeachingPoints,
    visualAnchorCatalog: options.clinicalPackage.visualAnchorCatalog,
    sourceGovernance: createSourceGovernanceView({
      canonicalDiseaseName: options.clinicalPackage.diseasePacket.canonicalDiseaseName,
      sourceRecords: options.clinicalPackage.sourceRecords,
      governanceDecisions: options.clinicalPackage.governanceDecisions,
    }),
    contradictionResolutions: options.clinicalPackage.contradictionResolutions ?? [],
    traceCoverage: createTraceCoverageView(options.clinicalPackage.traceCoverage),
  };
}

/**
 * @param {{ latestEvalStatus: string, latestEvalRun?: any | null }} options
 * @returns {any}
 */
export function createEvaluationSummaryView(options) {
  return {
    schemaVersion: SCHEMA_VERSION,
    latestEvalRunId: options.latestEvalRun?.id,
    latestEvalStatus: options.latestEvalStatus,
    evaluatedAt: options.latestEvalRun?.evaluatedAt,
    allThresholdsMet: options.latestEvalRun?.summary?.allThresholdsMet,
    familyStatuses: (options.latestEvalRun?.familyResults ?? []).map((/** @type {any} */ familyResult) => ({
      family: familyResult.family,
      status: familyResult.status,
      score: familyResult.score,
      threshold: familyResult.threshold,
      releaseGate: familyResult.releaseGate,
    })),
  };
}

/**
 * @param {{ runId: string, entries: any[] }} options
 * @returns {any}
 */
export function createExportHistoryView(options) {
  return {
    schemaVersion: SCHEMA_VERSION,
    runId: options.runId,
    entries: options.entries ?? [],
  };
}

/**
 * @param {{ runId: string, renderingGuide: any, markdown: string, attachmentSummary: any }} options
 * @returns {any}
 */
export function createRenderingGuideView(options) {
  return {
    schemaVersion: SCHEMA_VERSION,
    runId: options.runId,
    renderingGuide: options.renderingGuide,
    markdown: options.markdown,
    attachmentSummary: options.attachmentSummary,
    availableActions: [
      'regenerate-rendering-guide',
      'copy-rendering-guide-markdown',
      'download-rendering-guide-markdown',
      'attach-rendered-assets',
    ],
  };
}

/**
 * @param {{ runId: string, artifactTypeFilters?: string[], expand: boolean, artifacts: any[] }} options
 * @returns {any}
 */
export function createWorkflowArtifactListView(options) {
  return {
    schemaVersion: SCHEMA_VERSION,
    runId: options.runId,
    artifactTypeFilters: options.artifactTypeFilters ?? [],
    expand: options.expand,
    artifacts: options.artifacts ?? [],
  };
}

/**
 * @param {{ actor: any, tenantId: string, serverBaseUrl: string, storage: { dbFilePath: string, objectStoreDir: string }, platform: { metadataStore: string, objectStore: string, queueBackend: string, telemetryBackend: string }, availableCommands: string[], readiness: any }} options
 * @returns {any}
 */
export function createLocalRuntimeView(options) {
  return {
    schemaVersion: SCHEMA_VERSION,
    actor: {
      id: options.actor.id,
      displayName: options.actor.displayName,
      roles: options.actor.roles ?? [],
    },
    tenantId: options.tenantId,
    serverBaseUrl: options.serverBaseUrl,
    storage: options.storage,
    platform: options.platform,
    availableCommands: options.availableCommands,
    readiness: options.readiness,
  };
}

/**
 * @param {{ workflowRuns: any[], projectsById: Map<string, any>, runSummaries: Map<string, any>, filters: Record<string, string> }} options
 * @returns {any}
 */
export function createReviewDashboardView(options) {
  const runs = options.workflowRuns.map((workflowRun) => {
    const project = options.projectsById.get(workflowRun.projectId);
    const summary = options.runSummaries.get(workflowRun.id) ?? {
      exportCount: 0,
      latestEvalStatus: 'missing',
      assignees: [],
      openCommentCount: 0,
    };

    return {
      runId: workflowRun.id,
      projectTitle: project?.title ?? 'Untitled project',
      diseaseName: workflowRun.input?.diseaseName ?? project?.input?.diseaseName ?? 'Unknown disease',
      state: workflowRun.state,
      currentStage: workflowRun.currentStage,
      assignees: summary.assignees ?? [],
      openCommentCount: summary.openCommentCount ?? 0,
      pauseReason: workflowRun.pauseReason,
      latestEvalStatus: summary.latestEvalStatus,
      exportCount: summary.exportCount,
      activeWorkItemCount: summary.activeWorkItemCount ?? 0,
      overdueWorkItemCount: summary.overdueWorkItemCount ?? 0,
      threadCount: summary.threadCount ?? 0,
      updatedAt: workflowRun.updatedAt,
    };
  });

  return {
    schemaVersion: SCHEMA_VERSION,
    title: 'Local Review Dashboard',
    filters: {
      disease: options.filters.disease ?? '',
      state: options.filters.state ?? '',
      stage: options.filters.stage ?? '',
      assignee: options.filters.assignee ?? '',
      exportStatus: options.filters.exportStatus ?? '',
      evalStatus: options.filters.evalStatus ?? '',
      queueStatus: options.filters.queueStatus ?? '',
      workType: options.filters.workType ?? '',
      sort: options.filters.sort ?? 'updated-desc',
    },
    stats: {
      visibleRunCount: runs.length,
      blockedClinicalRunCount: runs.filter((run) => run.pauseReason === 'clinical-governance-blocked' || run.pauseReason === 'clinical-governance-review-required').length,
      awaitingReviewCount: runs.filter((run) => run.state === 'review').length,
      assignedRunCount: runs.filter((run) => run.assignees.length > 0).length,
      openCommentCount: runs.reduce((total, run) => total + run.openCommentCount, 0),
      staleEvalCount: runs.filter((run) => run.latestEvalStatus === 'stale').length,
      exportReadyCount: runs.filter((run) => run.state === 'approved' && run.latestEvalStatus === 'passed').length,
      overdueWorkItemCount: runs.reduce((total, run) => total + (run.overdueWorkItemCount ?? 0), 0),
      escalatedWorkItemCount: runs.filter((run) => (run.overdueWorkItemCount ?? 0) > 0).length,
    },
    runs,
  };
}

/**
 * @param {{ project: any, workflowRun: any, clinicalPackage: any, reviewAssignments?: any[], reviewComments?: any[], workItems?: any[], reviewThreads?: any[], renderJobs?: any[], renderingGuide?: any | null, latestEvalRun?: any | null, latestEvalStatus: string, exportHistory: any[] }} options
 * @returns {any}
 */
export function createReviewRunView(options) {
  return {
    schemaVersion: SCHEMA_VERSION,
    runId: options.workflowRun.id,
    projectTitle: options.project.title,
    diseaseName: options.workflowRun.input.diseaseName,
    state: options.workflowRun.state,
    currentStage: options.workflowRun.currentStage,
    pauseReason: options.workflowRun.pauseReason,
    stageTimeline: options.workflowRun.stages.map((/** @type {any} */ stage) => ({
      name: stage.name,
      status: stage.status,
      notes: stage.notes,
    })),
    clinicalPackage: createClinicalPackageView({
      runId: options.workflowRun.id,
      clinicalPackage: options.clinicalPackage,
    }),
    reviewAssignments: options.reviewAssignments ?? [],
    reviewComments: options.reviewComments ?? [],
    workItems: options.workItems ?? [],
    reviewThreads: options.reviewThreads ?? [],
    evaluationSummary: createEvaluationSummaryView({
      latestEvalStatus: options.latestEvalStatus,
      latestEvalRun: options.latestEvalRun,
    }),
    exportHistory: createExportHistoryView({
      runId: options.workflowRun.id,
      entries: options.exportHistory,
    }),
    renderingGuide: options.renderingGuide ?? undefined,
    renderJobs: options.renderJobs ?? [],
    availableActions: [
      'resolve-canonicalization',
      'assign-reviewer',
      'record-review-comment',
      'open-review-thread',
      'compare-artifacts',
      'record-approval',
      'record-source-decision',
      'record-contradiction-resolution',
      'assign-source-owner',
      'create-source-refresh-task',
      'rebuild-clinical-package',
      'regenerate-rendering-guide',
      'run-evaluations',
      'attach-rendered-assets',
      'export-bundle',
    ],
  };
}
