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
 * @param {{ actor: any, tenantId: string, serverBaseUrl: string, storage: { dbFilePath: string, objectStoreDir: string }, availableCommands: string[], readiness: any }} options
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
    };

    return {
      runId: workflowRun.id,
      projectTitle: project?.title ?? 'Untitled project',
      diseaseName: workflowRun.input?.diseaseName ?? project?.input?.diseaseName ?? 'Unknown disease',
      state: workflowRun.state,
      currentStage: workflowRun.currentStage,
      pauseReason: workflowRun.pauseReason,
      latestEvalStatus: summary.latestEvalStatus,
      exportCount: summary.exportCount,
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
      exportStatus: options.filters.exportStatus ?? '',
      evalStatus: options.filters.evalStatus ?? '',
      sort: options.filters.sort ?? 'updated-desc',
    },
    stats: {
      visibleRunCount: runs.length,
      blockedClinicalRunCount: runs.filter((run) => run.pauseReason === 'clinical-governance-blocked' || run.pauseReason === 'clinical-governance-review-required').length,
      awaitingReviewCount: runs.filter((run) => run.state === 'review').length,
      staleEvalCount: runs.filter((run) => run.latestEvalStatus === 'stale').length,
      exportReadyCount: runs.filter((run) => run.state === 'approved' && run.latestEvalStatus === 'passed').length,
    },
    runs,
  };
}

/**
 * @param {{ project: any, workflowRun: any, clinicalPackage: any, latestEvalRun?: any | null, latestEvalStatus: string, exportHistory: any[] }} options
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
    evaluationSummary: createEvaluationSummaryView({
      latestEvalStatus: options.latestEvalStatus,
      latestEvalRun: options.latestEvalRun,
    }),
    exportHistory: createExportHistoryView({
      runId: options.workflowRun.id,
      entries: options.exportHistory,
    }),
    availableActions: [
      'resolve-canonicalization',
      'record-approval',
      'record-source-decision',
      'record-contradiction-resolution',
      'rebuild-clinical-package',
      'run-evaluations',
      'export-bundle',
    ],
  };
}
