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
 * @param {{ runId: string, renderingGuide: any, markdown: string, attachmentSummary: any, visualReferencePack?: any | null, reviewDecision?: any | null, gateStatus?: string, renderDisabledReason?: string, guideWarnings?: string[] }} options
 * @returns {any}
 */
export function createRenderingGuideView(options) {
  const gateStatus = options.gateStatus ?? 'not-reviewed';
  const renderingApproved = gateStatus === 'approved';

  return {
    schemaVersion: SCHEMA_VERSION,
    runId: options.runId,
    renderingGuide: options.renderingGuide,
    markdown: options.markdown,
    attachmentSummary: options.attachmentSummary,
    visualReferencePack: options.visualReferencePack ?? null,
    reviewDecision: options.reviewDecision ?? null,
    gateStatus,
    renderDisabledReason: options.renderDisabledReason ?? '',
    guideWarnings: options.guideWarnings ?? [],
    availableActions: [
      'regenerate-rendering-guide',
      'regenerate-visual-reference-pack',
      'approve-rendering-guide',
      'request-rendering-guide-changes',
      'reject-rendering-guide',
      'copy-rendering-guide-markdown',
      'download-rendering-guide-markdown',
      ...(renderingApproved ? ['queue-panel-rendering', 'attach-rendered-assets'] : []),
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
 * @param {{ actor: any, tenantId: string, serverBaseUrl: string, storage: { dbFilePath: string, objectStoreDir: string }, platform: { runtimeMode: string, metadataStore: string, objectStore: string, queueBackend: string, telemetryBackend: string }, availableCommands: string[], readiness: any, localStoragePolicy?: any, externalElements?: any }} options
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
    ...(options.localStoragePolicy ? { localStoragePolicy: options.localStoragePolicy } : {}),
    ...(options.externalElements ? { externalElements: options.externalElements } : {}),
  };
}

const CREATOR_STEPS = Object.freeze([
  {
    id: 'medical-research',
    label: 'Research disease',
    description: 'Compile the high-yield medical dossier with source-traceable agent research.',
    path: 'clinical-review',
  },
  {
    id: 'medical-dossier-review',
    label: 'Review medical dossier',
    description: 'Approve the medical facts before the disease becomes the mystery culprit.',
    path: 'clinical-review',
  },
  {
    id: 'clinical-review',
    label: 'Clinical package review',
    description: 'Confirm the disease packet, sources, contradictions, and clinical traceability.',
    path: 'clinical-review',
  },
  {
    id: 'story-panel-plan',
    label: 'Story and panel plan',
    description: 'Check the mystery craft, scene flow, panel order, and continuity plan.',
    path: 'story-panel-plan',
  },
  {
    id: 'guide-review',
    label: 'Guide review',
    description: 'Approve the rendering guide, Cyto/Pip locks, and visual reference pack before image generation.',
    path: 'guide-review',
  },
  {
    id: 'render-panels',
    label: 'Render panels',
    description: 'Create or review final panel art from the approved guide/reference pair.',
    path: 'render-panels',
  },
  {
    id: 'final-checks',
    label: 'Final checks',
    description: 'Run deterministic safety checks and confirm the release gates are fresh and passing.',
    path: 'export',
  },
  {
    id: 'export',
    label: 'Export',
    description: 'Create the local release package, mirror it locally, and verify integrity.',
    path: 'export',
  },
]);

const CREATOR_ADVANCED_LINKS = Object.freeze([
  ['Pipeline', 'advanced/pipeline', 'Workflow stages, artifact status, and audit flow.'],
  ['Review console', 'advanced/review-console', 'Assignments, comments, threads, approvals, and safety-check actions.'],
  ['Packets', 'advanced/packets', 'Disease packet, fact table, teaching points, and anchors.'],
  ['Evidence', 'advanced/evidence', 'Evidence graph, contradictions, and traceability blockers.'],
  ['Workbooks', 'advanced/workbooks', 'Story workbook, craft report, narrative trace, and QA.'],
  ['Scenes', 'advanced/scenes', 'Scene-card sequencing and narrative beats.'],
  ['Panels', 'advanced/panels', 'Panel plans, render prompts, rendered assets, lettering maps, and panel QA.'],
  ['Full rendering guide', 'rendering-guide', 'The complete pre-render workbench and markdown guide.'],
  ['Sources', 'advanced/sources', 'Run-scoped governed source records and source actions.'],
  ['Governance', 'advanced/governance', 'Approvals, audit log, and clinical blocker state.'],
  ['Evals', 'advanced/evals', 'Eval families, gate state, and rerun action.'],
  ['Bundles', 'advanced/bundles', 'Release bundles, export history, and retrieval links.'],
]);

/**
 * @param {string} runId
 * @param {string} suffix
 * @returns {string}
 */
function creatorRunPath(runId, suffix) {
  return `/runs/${encodeURIComponent(runId)}/${suffix}`;
}

/**
 * @param {any} workflowRun
 * @param {string} artifactType
 * @returns {boolean}
 */
function workflowRunHasArtifact(workflowRun, artifactType) {
  return (/** @type {any[]} */ (workflowRun.artifacts ?? [])).some((artifactReference) => artifactReference.artifactType === artifactType);
}

/**
 * @param {string} latestEvalStatus
 * @returns {boolean}
 */
function latestEvalNeedsAttention(latestEvalStatus) {
  return latestEvalStatus !== 'passed';
}

/**
 * @param {any} renderingGuide
 * @returns {boolean}
 */
function isRenderingGuideApproved(renderingGuide) {
  return renderingGuide?.reviewStatus === 'approved';
}

/**
 * @param {{ workflowRun: any, renderJobs?: any[] }} options
 * @returns {boolean}
 */
function hasRenderedManifest(options) {
  return workflowRunHasArtifact(options.workflowRun, 'rendered-asset-manifest')
    || (/** @type {any[]} */ (options.renderJobs ?? [])).some((renderJob) => Boolean(renderJob.renderedAssetManifestId));
}

/**
 * @param {string | undefined} pauseReason
 * @returns {string | undefined}
 */
function friendlyPauseReason(pauseReason) {
  /** @type {Record<string, string>} */
  const labels = {
    'clinical-governance-blocked': 'Clinical source governance is blocking this run.',
    'clinical-governance-review-required': 'Clinical review is required before story generation can continue.',
    'medical-dossier-review-required': 'Review and approve the high-yield medical dossier before story generation can continue.',
    'provisional-knowledge-pack-review-required': 'The provisional disease pack needs approval before export.',
    'render-guide-review-required': 'The rendering guide and visual reference pack need approval before panels can render.',
  };

  return pauseReason ? labels[pauseReason] ?? `This run is paused: ${pauseReason}.` : undefined;
}

/**
 * @param {{ workflowRun: any, clinicalPackage?: any, reviewComments?: any[], workItems?: any[], latestEvalStatus: string }} options
 * @returns {Array<{ severity: 'info' | 'warning' | 'critical', title: string, detail: string, sourceType?: string, sourceId?: string }>}
 */
function buildCreatorBlockers(options) {
  /** @type {Array<{ severity: 'info' | 'warning' | 'critical', title: string, detail: string, sourceType?: string, sourceId?: string }>} */
  const blockers = [];
  const pauseBlocker = friendlyPauseReason(options.workflowRun.pauseReason);

  if (pauseBlocker) {
    blockers.push({
      severity: options.workflowRun.pauseReason?.includes('blocked') ? 'critical' : 'warning',
      title: 'Run needs review',
      detail: pauseBlocker,
      sourceType: 'workflow-run',
      sourceId: options.workflowRun.id,
    });
  }

  const traceBlockers = /** @type {string[]} */ (options.clinicalPackage?.traceCoverage?.blockers ?? []);
  traceBlockers.slice(0, 3).forEach((detail) => {
    blockers.push({
      severity: 'critical',
      title: 'Clinical traceability blocker',
      detail,
      sourceType: 'clinical-package',
      sourceId: options.workflowRun.id,
    });
  });

  const criticalComments = /** @type {any[]} */ (options.reviewComments ?? []).filter((comment) => comment.status === 'open' && comment.severity === 'critical');
  criticalComments.slice(0, 3).forEach((comment) => {
    blockers.push({
      severity: 'critical',
      title: 'Critical reviewer comment',
      detail: comment.body,
      sourceType: 'review-comment',
      sourceId: comment.id,
    });
  });

  const overdueWorkItems = /** @type {any[]} */ (options.workItems ?? []).filter((workItem) => (
    workItem.status !== 'completed' && workItem.status !== 'cancelled' && workItem.dueAt && new Date(workItem.dueAt).getTime() < Date.now()
  ));
  overdueWorkItems.slice(0, 2).forEach((workItem) => {
    blockers.push({
      severity: 'warning',
      title: 'Overdue queue item',
      detail: `${workItem.workType} is due for ${workItem.assignedActorDisplayName ?? 'the local operator'}.`,
      sourceType: 'work-item',
      sourceId: workItem.id,
    });
  });

  if (latestEvalNeedsAttention(options.latestEvalStatus)) {
    blockers.push({
      severity: options.latestEvalStatus === 'failed' ? 'critical' : 'warning',
      title: 'Safety checks need attention',
      detail: options.latestEvalStatus === 'missing'
        ? 'Run safety checks before export.'
        : `Latest safety-check status is ${options.latestEvalStatus}.`,
      sourceType: 'eval-run',
      sourceId: options.workflowRun.latestEvalRunId ?? options.workflowRun.id,
    });
  }

  return blockers;
}

/**
 * @param {{ workflowRun: any, renderingGuide?: any, renderJobs?: any[], exportHistory?: any[], latestEvalStatus: string }} options
 * @returns {string}
 */
function deriveCreatorActiveStep(options) {
  const workflowRun = options.workflowRun;
  const hasMedicalDossier = workflowRunHasArtifact(workflowRun, 'medical-dossier');
  const hasStoryAndPanels = workflowRunHasArtifact(workflowRun, 'story-workbook') && workflowRunHasArtifact(workflowRun, 'panel-plan');
  const hasGuide = workflowRunHasArtifact(workflowRun, 'rendering-guide') || Boolean(options.renderingGuide);
  const guideApproved = isRenderingGuideApproved(options.renderingGuide);

  if (!hasMedicalDossier || ['intake', 'canonicalization', 'research-assembly'].includes(workflowRun.currentStage)) {
    return workflowRun.pauseReason === 'medical-dossier-review-required' || hasMedicalDossier
      ? 'medical-dossier-review'
      : 'medical-research';
  }

  if (workflowRun.pauseReason === 'medical-dossier-review-required') {
    return 'medical-dossier-review';
  }

  if (
    workflowRun.pauseReason === 'clinical-governance-blocked'
    || workflowRun.pauseReason === 'clinical-governance-review-required'
    || workflowRun.pauseReason === 'provisional-knowledge-pack-review-required'
    || ['intake', 'canonicalization', 'disease-packet', 'clinical-package', 'review'].includes(workflowRun.currentStage)
  ) {
    return 'clinical-review';
  }

  if (!hasStoryAndPanels) {
    return 'story-panel-plan';
  }

  if (!hasGuide || !guideApproved || workflowRun.pauseReason === 'render-guide-review-required') {
    return 'guide-review';
  }

  if (!hasRenderedManifest(options)) {
    return 'render-panels';
  }

  if (latestEvalNeedsAttention(options.latestEvalStatus)) {
    return 'final-checks';
  }

  if ((options.exportHistory ?? []).length === 0) {
    return 'export';
  }

  return 'complete';
}

/**
 * @param {string} activeStep
 * @param {boolean} completed
 * @returns {string}
 */
function labelForCreatorAction(activeStep, completed) {
  if (completed) {
    return 'Open latest export';
  }

  /** @type {Record<string, string>} */
  const labels = {
    'medical-research': 'Research disease',
    'medical-dossier-review': 'Review medical dossier',
    'clinical-review': 'Review clinical package',
    'story-panel-plan': 'Review story and panel plan',
    'guide-review': 'Review rendering guide',
    'render-panels': 'Render panels',
    'final-checks': 'Run safety checks',
    export: 'Export local package',
  };

  return labels[activeStep] ?? 'Open run';
}

/**
 * @param {string} runId
 * @param {string} activeStep
 * @returns {string}
 */
function targetPathForCreatorStep(runId, activeStep) {
  const step = CREATOR_STEPS.find((candidate) => candidate.id === activeStep);
  return creatorRunPath(runId, step?.path ?? 'overview');
}

/**
 * @param {string} activeStep
 * @param {Array<{ severity: string, detail: string }>} blockers
 * @returns {string}
 */
function friendlyStatusForCreatorStep(activeStep, blockers) {
  if (blockers.some((blocker) => blocker.severity === 'critical')) {
    return blockers[0].detail;
  }

  /** @type {Record<string, string>} */
  const labels = {
    'medical-research': 'Medical agents are compiling a high-yield source-traceable dossier.',
    'medical-dossier-review': 'Medical dossier needs approval before the story can begin.',
    'clinical-review': 'Ready for clinical package review.',
    'story-panel-plan': 'Story and panel plan are being checked.',
    'guide-review': 'Rendering guide needs review before any panels render.',
    'render-panels': 'Guide is approved; panels are ready to render or review.',
    'final-checks': 'Rendered panels need fresh passing evals before export.',
    export: 'Ready to export the local release bundle.',
    complete: 'Local release bundle is available.',
  };

  return labels[activeStep] ?? 'Run is ready for review.';
}

/**
 * @param {{ workflowRun: any, clinicalPackage?: any, reviewComments?: any[], workItems?: any[], renderingGuide?: any, renderJobs?: any[], latestEvalStatus: string, exportHistory?: any[] }} options
 * @returns {any}
 */
function buildCreatorWorkflow(options) {
  const activeStep = deriveCreatorActiveStep(options);
  const blockers = buildCreatorBlockers(options);
  const completed = activeStep === 'complete';
  const activeStepIndex = CREATOR_STEPS.findIndex((step) => step.id === activeStep);
  const primaryBlocker = blockers[0]?.detail;

  return {
    friendlyStatus: friendlyStatusForCreatorStep(activeStep, blockers),
    activeStep,
    ...(primaryBlocker ? { primaryBlocker } : {}),
    primaryAction: {
      label: labelForCreatorAction(activeStep, completed),
      targetPath: completed ? creatorRunPath(options.workflowRun.id, 'export') : targetPathForCreatorStep(options.workflowRun.id, activeStep),
      actionId: completed ? 'open-export' : activeStep,
      ...(primaryBlocker ? { disabledReason: primaryBlocker } : {}),
    },
    steps: CREATOR_STEPS.map((step, index) => {
      const isCurrent = step.id === activeStep;

      return {
        id: step.id,
        label: step.label,
        status: completed || index < activeStepIndex
          ? 'complete'
          : isCurrent && blockers.some((blocker) => blocker.severity === 'critical')
          ? 'blocked'
          : isCurrent
          ? 'current'
          : index === activeStepIndex + 1
          ? 'ready'
          : 'waiting',
        description: step.description,
        targetPath: creatorRunPath(options.workflowRun.id, step.path),
        ...(isCurrent && primaryBlocker ? { disabledReason: primaryBlocker } : {}),
      };
    }),
    blockers,
    advancedLinks: CREATOR_ADVANCED_LINKS.map(([label, path, description]) => ({
      label,
      path: creatorRunPath(options.workflowRun.id, path),
      description,
    })),
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
    const workflow = buildCreatorWorkflow({
      workflowRun,
      latestEvalStatus: summary.latestEvalStatus ?? 'missing',
      exportHistory: Array.from({ length: summary.exportCount ?? 0 }),
      workItems: summary.workItems ?? [],
      reviewComments: summary.reviewComments ?? [],
      renderingGuide: summary.renderingGuide ?? null,
      renderJobs: summary.renderJobs ?? [],
      clinicalPackage: summary.clinicalPackage ?? null,
    });

    return {
      runId: workflowRun.id,
      projectTitle: project?.title ?? 'Untitled project',
      diseaseName: workflowRun.input?.diseaseName ?? project?.input?.diseaseName ?? 'Unknown disease',
      friendlyStatus: workflow.friendlyStatus,
      activeStep: workflow.activeStep,
      ...(workflow.primaryBlocker ? { primaryBlocker: workflow.primaryBlocker } : {}),
      nextAction: workflow.primaryAction,
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
      blockedClinicalRunCount: runs.filter((run) => (
        run.pauseReason === 'medical-dossier-review-required'
        || run.pauseReason === 'clinical-governance-blocked'
        || run.pauseReason === 'clinical-governance-review-required'
      )).length,
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
 * @param {{ project: any, workflowRun: any, clinicalPackage?: any | null, medicalDossier?: any | null, medicalDossierBuildReport?: any | null, medicalDossierQaReport?: any | null, sourceDiscoveryReport?: any | null, agentRuns?: any[], reviewAssignments?: any[], reviewComments?: any[], workItems?: any[], reviewThreads?: any[], renderJobs?: any[], renderingGuide?: any | null, latestEvalRun?: any | null, latestEvalStatus: string, exportHistory: any[] }} options
 * @returns {any}
 */
export function createReviewRunView(options) {
  const clinicalPackageView = options.clinicalPackage
    ? createClinicalPackageView({
      runId: options.workflowRun.id,
      clinicalPackage: options.clinicalPackage,
    })
    : undefined;

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
    creatorWorkflow: buildCreatorWorkflow({
      workflowRun: options.workflowRun,
      clinicalPackage: clinicalPackageView,
      reviewComments: options.reviewComments ?? [],
      workItems: options.workItems ?? [],
      renderingGuide: options.renderingGuide ?? null,
      renderJobs: options.renderJobs ?? [],
      latestEvalStatus: options.latestEvalStatus,
      exportHistory: options.exportHistory,
    }),
    ...(clinicalPackageView ? { clinicalPackage: clinicalPackageView } : {}),
    ...(options.medicalDossier ? { medicalDossier: options.medicalDossier } : {}),
    ...(options.medicalDossierBuildReport ? { medicalDossierBuildReport: options.medicalDossierBuildReport } : {}),
    ...(options.medicalDossierQaReport ? { medicalDossierQaReport: options.medicalDossierQaReport } : {}),
    ...(options.sourceDiscoveryReport ? { sourceDiscoveryReport: options.sourceDiscoveryReport } : {}),
    agentRuns: options.agentRuns ?? [],
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
