import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppRoutes } from '@/App';
import { RefreshProvider } from '@/lib/refresh-context';

const dashboardView = {
  schemaVersion: '1.0.0',
  title: 'Local Review Dashboard',
  filters: {
    disease: '',
    state: '',
    stage: '',
    assignee: '',
    exportStatus: '',
    evalStatus: '',
    queueStatus: '',
    workType: '',
    sort: 'updated-desc',
  },
  stats: {
    visibleRunCount: 1,
    blockedClinicalRunCount: 0,
    awaitingReviewCount: 1,
    assignedRunCount: 1,
    openCommentCount: 1,
    staleEvalCount: 0,
    exportReadyCount: 0,
    overdueWorkItemCount: 0,
    escalatedWorkItemCount: 0,
  },
  runs: [
    {
      runId: 'run.local.001',
      projectTitle: 'Community-acquired pneumonia starter project',
      diseaseName: 'Community-acquired pneumonia',
      state: 'review',
      currentStage: 'review',
      assignees: ['Local Operator'],
      openCommentCount: 1,
      latestEvalStatus: 'passed',
      exportCount: 1,
      activeWorkItemCount: 1,
      overdueWorkItemCount: 0,
      threadCount: 1,
      updatedAt: '2026-04-22T12:00:00Z',
    },
  ],
};

const queueView = {
  schemaVersion: '1.0.0',
  filters: {
    workType: '',
    status: '',
    priority: '',
    queueName: '',
    assignee: '',
  },
  stats: {
    visibleItemCount: 1,
    overdueItemCount: 0,
    escalatedItemCount: 0,
    renderRetryCount: 0,
    sourceRefreshCount: 0,
  },
  items: [
    {
      workItemId: 'wrk.local.001',
      workflowRunId: 'run.local.001',
      projectTitle: 'Community-acquired pneumonia starter project',
      diseaseName: 'Community-acquired pneumonia',
      workType: 'run-review',
      status: 'queued',
      priority: 'medium',
      queueName: 'review-queue',
      subjectType: 'workflow-run',
      subjectId: 'run.local.001',
      assignedActorDisplayName: 'Local Operator',
      dueAt: '2026-04-22T16:00:00Z',
      reminderAt: '2026-04-22T14:00:00Z',
      isOverdue: false,
      threadCount: 1,
      notes: ['Clinical review is ready for follow-through.'],
    },
  ],
};

const queueAnalyticsView = {
  schemaVersion: '1.0.0',
  summary: {
    totalItemCount: 1,
    overdueItemCount: 0,
    escalatedItemCount: 0,
    overdueRate: 0,
    escalationRate: 0,
    medianAgeHours: 2,
  },
  countsByWorkType: [{ workType: 'run-review', count: 1 }],
  countsByStatus: [{ status: 'queued', count: 1 }],
  countsByPriority: [{ priority: 'medium', count: 1 }],
  assigneeLoad: [{ assignee: 'Local Operator', count: 1 }],
  runBlockersByStage: [{ stage: 'review', count: 1 }],
};

const notifications = [
  {
    schemaVersion: '1.0.0',
    id: 'ntf.local.001',
    tenantId: 'tenant.local',
    targetActorId: 'local-operator',
    workflowRunId: 'run.local.001',
    threadId: 'thr.local.001',
    notificationType: 'mention',
    status: 'unread',
    message: 'You were mentioned on run.local.001',
    createdAt: '2026-04-22T12:00:00Z',
    updatedAt: '2026-04-22T12:00:00Z',
  },
];

const workflowRun = {
  id: 'run.local.001',
  projectId: 'prj.local.001',
  state: 'review',
  currentStage: 'review',
  createdAt: '2026-04-22T11:00:00Z',
  updatedAt: '2026-04-22T12:00:00Z',
  latestEvalStatus: 'passed',
  input: {
    diseaseName: 'Community-acquired pneumonia',
  },
  stages: [
    { name: 'intake', status: 'passed' },
    { name: 'canonicalization', status: 'passed' },
    { name: 'disease-packet', status: 'passed' },
    { name: 'review', status: 'running' },
  ],
  artifacts: [
    { artifactType: 'story-workbook', artifactId: 'swb.local.001', status: 'generated' },
    { artifactType: 'panel-plan', artifactId: 'pnl.local.001', status: 'generated' },
    { artifactType: 'render-prompt', artifactId: 'rnd.local.001', status: 'generated' },
    { artifactType: 'release-bundle', artifactId: 'rel.local.001', status: 'exported' },
  ],
  approvals: [
    { role: 'clinical', decision: 'approved', reviewerId: 'local-operator' },
    { role: 'editorial', decision: 'approved', reviewerId: 'local-operator' },
  ],
  requiredApprovalRoles: ['clinical', 'editorial'],
};

const clinicalPackage = {
  schemaVersion: '1.0.0',
  runId: 'run.local.001',
  canonicalDisease: {
    id: 'can.local.001',
    canonicalDiseaseName: 'Community-acquired pneumonia',
  },
  diseasePacket: {
    canonicalDiseaseName: 'Community-acquired pneumonia',
    evidenceSummary: {
      governanceVerdict: 'approved',
      blockingContradictions: 0,
    },
  },
  factTable: {
    id: 'fact.local.001',
    rows: [{ claimId: 'claim.local.001' }],
  },
  evidenceGraph: {
    id: 'graph.local.001',
    relationships: [],
  },
  clinicalTeachingPoints: {
    id: 'teach.local.001',
    teachingPoints: [],
  },
  visualAnchorCatalog: {
    id: 'anchor.local.001',
    anchors: [],
  },
    sourceGovernance: {
      canonicalDiseaseName: 'Community-acquired pneumonia',
      sourceRecords: [
        {
          id: 'src.local.001',
          canonicalDiseaseName: 'Community-acquired pneumonia',
          sourceLabel: 'Starter source',
          sourceType: 'guideline',
          sourceTier: 'tier-1',
          approvalStatus: 'approved',
          freshnessScore: 0.97,
          freshnessStatus: 'current',
          contradictionStatus: 'none',
          lastReviewedAt: '2026-04-22T12:00:00Z',
          primaryOwnerRole: 'Clinical Reviewer',
          backupOwnerRole: 'Product Editor',
          refreshCadenceDays: 180,
          nextReviewDueAt: '2026-10-19T12:00:00Z',
          freshnessState: 'current',
          sourceUrl: 'https://example.org/source',
          impactedDiseaseCount: 1,
          impactedRunCount: 1,
          openRefreshTaskCount: 0,
        },
      ],
      governanceDecisions: [],
    },
  contradictionResolutions: [],
  traceCoverage: {
    score: 1,
    verdict: 'passed',
    validClaimCount: 1,
    suspendedSourceCount: 0,
    staleSourceCount: 0,
    blockingContradictions: 0,
    artifactSummaries: [],
    blockers: [],
  },
};

const reviewRunView = {
  schemaVersion: '1.0.0',
  runId: 'run.local.001',
  projectTitle: 'Community-acquired pneumonia starter project',
  diseaseName: 'Community-acquired pneumonia',
  state: 'review',
  currentStage: 'review',
  stageTimeline: workflowRun.stages,
  clinicalPackage,
  reviewAssignments: [
    {
      schemaVersion: '1.0.0',
      id: 'asg.local.001',
      tenantId: 'tenant.local',
      workflowRunId: 'run.local.001',
      reviewRole: 'clinical',
      assigneeId: 'local-operator',
      assigneeDisplayName: 'Local Operator',
      assigneeRoles: ['Local Operator'],
      status: 'in-progress',
      createdAt: '2026-04-22T12:05:00Z',
      updatedAt: '2026-04-22T12:05:00Z',
    },
  ],
  reviewComments: [
    {
      schemaVersion: '1.0.0',
      id: 'cmt.local.001',
      tenantId: 'tenant.local',
      workflowRunId: 'run.local.001',
      scopeType: 'artifact',
      artifactType: 'panel-plan',
      artifactId: 'pnl.local.001',
      fieldPath: 'panels[0].medicalObjective',
      status: 'open',
      severity: 'warning',
      body: 'Tie the opening panel more directly to the evidence claim.',
      reviewerId: 'local-operator',
      reviewerDisplayName: 'Local Operator',
      reviewerRoles: ['Local Operator'],
      createdAt: '2026-04-22T12:06:00Z',
      updatedAt: '2026-04-22T12:06:00Z',
    },
  ],
  workItems: [
    {
      schemaVersion: '1.0.0',
      id: 'wrk.local.001',
      tenantId: 'tenant.local',
      workflowRunId: 'run.local.001',
      workType: 'run-review',
      status: 'queued',
      priority: 'medium',
      queueName: 'review-queue',
      fallbackQueueName: 'review-queue-fallback',
      subjectType: 'workflow-run',
      subjectId: 'run.local.001',
      assignedActorId: 'local-operator',
      assignedActorDisplayName: 'Local Operator',
      assignedActorRoles: ['Local Operator'],
      slaHours: 4,
      reminderAt: '2026-04-22T13:00:00Z',
      dueAt: '2026-04-22T15:00:00Z',
      notes: ['Clinical review is ready for follow-through.'],
      createdAt: '2026-04-22T12:00:00Z',
      updatedAt: '2026-04-22T12:00:00Z',
    },
  ],
  reviewThreads: [
    {
      schemaVersion: '1.0.0',
      id: 'thr.local.001',
      tenantId: 'tenant.local',
      workflowRunId: 'run.local.001',
      scopeType: 'run',
      title: 'Run review thread',
      status: 'open',
      participantIds: ['local-operator'],
      createdBy: 'local-operator',
      createdAt: '2026-04-22T12:00:00Z',
      updatedAt: '2026-04-22T12:00:00Z',
      messages: [
        {
          schemaVersion: '1.0.0',
          id: 'msg.local.001',
          threadId: 'thr.local.001',
          tenantId: 'tenant.local',
          workflowRunId: 'run.local.001',
          authorId: 'local-operator',
          authorDisplayName: 'Local Operator',
          body: 'Initial review context recorded locally.',
          mentions: [],
          status: 'posted',
          createdAt: '2026-04-22T12:00:00Z',
          updatedAt: '2026-04-22T12:00:00Z',
        },
      ],
    },
  ],
  evaluationSummary: {
    schemaVersion: '1.0.0',
    latestEvalRunId: 'evl.local.001',
    latestEvalStatus: 'passed',
    evaluatedAt: '2026-04-22T12:00:00Z',
    allThresholdsMet: true,
    familyStatuses: [
      {
        family: 'medical_accuracy',
        status: 'passed',
        threshold: 0.95,
        releaseGate: 'Gate 2',
      },
    ],
  },
  exportHistory: {
    schemaVersion: '1.0.0',
    runId: 'run.local.001',
    entries: [
      {
        id: 'exp.local.001',
        releaseId: 'rel.local.001',
        workflowRunId: 'run.local.001',
        status: 'completed',
        exportedAt: '2026-04-22T12:15:00Z',
      },
    ],
  },
  renderingGuide: {
    id: 'rgd.local.001',
    workflowRunId: 'run.local.001',
    tenantId: 'tenant.local',
    projectTitle: 'Community-acquired pneumonia starter project',
    canonicalDiseaseName: 'Community-acquired pneumonia',
    generatedAt: '2026-04-22T12:10:00Z',
    markdownDocumentId: 'rgd.local.001',
    markdownLocation: '/api/v1/release-bundles/rel.local.001/rendering-guide',
    runSummary: {
      oneSentence: 'A lung infection should emerge through fair mystery clues.',
      patientExperienceSummary: 'The patient becomes progressively short of breath and febrile.',
      keyMechanism: 'Inflammatory filling impairs gas exchange.',
      timeScale: 'hours to days',
      educationalFocus: ['gas exchange'],
      audienceTier: 'provider-education',
      styleProfile: 'whimsical-mystery',
    },
    franchiseRules: ['Mystery first', 'Treatment is the climax'],
    continuityBible: {
      continuityAnchors: ['jet packs', 'alveoli', 'case tablet'],
      characterLocks: ['Detective A short', 'Detective B tall'],
      anatomyLocks: ['alveoli readable', 'no generic cave interiors'],
      styleLocks: ['comic mystery', 'clean staging'],
      letteringPolicy: 'Keep lettering separate from art.',
    },
    panelExecutionStrategy: {
      sequentialPanelExecutionRecommended: true,
      continuityReferenceRequired: true,
      separateLetteringRequired: true,
      manualReviewRequired: true,
    },
    globalNegativeConstraints: ['no labels', 'no text in art'],
    openAiPanelExecutionPrompt: 'Create one final image per panel, keep the order stable, and keep lettering out of the art.',
    retryGuidance: ['Reuse slide 1 as the style lock for the remaining slides.'],
    panels: [
      {
        panelId: 'pnl.local.001',
        sceneId: 'scn.local.001',
        pageNumber: 1,
        order: 1,
        storyFunction: 'opener',
        beatGoal: 'Introduce the case.',
        medicalObjective: 'Bridge symptoms to the lung environment.',
        location: 'alveolar district',
        bodyScale: 'tissue',
        actionSummary: 'The detectives hover beside crowded air sacs.',
        cameraFraming: 'medium shot',
        cameraAngle: 'slightly low',
        compositionNotes: 'Use vessel lines toward the affected alveoli.',
        lightingMood: 'humid tension',
        continuityAnchors: ['jet packs', 'alveoli', 'case tablet'],
        acceptanceChecks: ['alveoli readable'],
        claimReferences: [
          {
            claimId: 'claim.local.001',
            claimText: 'Inflammation fills alveoli and impairs gas exchange.',
            sourceId: 'src.local.001',
            sourceLabel: 'Starter source',
          },
        ],
        letteringEntries: [
          {
            entryId: 'lte.local.001',
            layerType: 'caption',
            text: 'The air sacs are crowding with inflammatory fluid.',
            placement: 'lower-third',
            purpose: 'Teaching overlay',
          },
        ],
        openAiImagePrompt: {
          aspectRatio: '4:3',
          prompt: 'Create a detailed comic-book illustration of detectives hovering beside crowded air sacs.',
          negativePrompt: 'no labels, no text in art',
          styleLocks: ['comic mystery'],
          characterLocks: ['Detective A short', 'Detective B tall'],
          anatomyLocks: ['alveoli readable', 'no generic cave interiors'],
          notes: ['Keep lettering separate.'],
        },
      },
    ],
  },
  renderJobs: [
    {
      schemaVersion: '1.0.0',
      id: 'rjob.local.001',
      tenantId: 'tenant.local',
      workflowRunId: 'run.local.001',
      status: 'completed',
      approvalStatus: 'approved',
      queueName: 'render-execution',
      provider: 'stub-image',
      model: 'stub-image-v1',
      renderTargetProfileId: 'rtp.openai-image-default',
      renderPromptIds: ['rnd.local.001'],
      attemptIds: ['ratm.local.001'],
      renderedAssetManifestId: 'rman.local.001',
      createdBy: 'local-operator',
      createdAt: '2026-04-22T12:01:00Z',
      updatedAt: '2026-04-22T12:03:00Z',
      completedAt: '2026-04-22T12:03:00Z',
    },
  ],
  availableActions: ['run-evaluations', 'export-bundle'],
};

const evaluations = [
  {
    id: 'evl.local.001',
    workflowRunId: 'run.local.001',
    evaluatedAt: '2026-04-22T12:00:00Z',
    summary: {
      allThresholdsMet: true,
    },
    familyResults: reviewRunView.evaluationSummary.familyStatuses,
  },
];

const renderingGuideView = {
  schemaVersion: '1.0.0',
  runId: 'run.local.001',
  renderingGuide: reviewRunView.renderingGuide,
  markdown: '# Rendering Guide rgd.local.001',
  attachmentSummary: {
    attachedRenderedAssetCount: 0,
    attachmentMode: 'guide-only',
  },
  availableActions: ['regenerate-rendering-guide', 'attach-rendered-assets'],
};

const auditEntries = [
  {
    id: 'aud.local.001',
    action: 'workflow-run.evaluate',
    subjectType: 'workflow-run',
    subjectId: 'run.local.001',
    outcome: 'success',
    occurredAt: '2026-04-22T12:00:00Z',
    reason: 'Executed eval run.',
  },
];

const artifacts = {
  schemaVersion: '1.0.0',
  runId: 'run.local.001',
  expand: true,
  artifacts: [
    {
      artifactType: 'story-workbook',
      artifactId: 'swb.local.001',
      status: 'generated',
      payload: {
        id: 'swb.local.001',
      },
    },
    {
      artifactType: 'panel-plan',
      artifactId: 'pnl.local.001',
      status: 'generated',
      payload: {
        id: 'pnl.local.001',
      },
    },
    {
      artifactType: 'render-prompt',
      artifactId: 'rnd.local.001',
      status: 'generated',
      payload: {
        id: 'rnd.local.001',
      },
    },
  ],
};

const localRuntimeView = {
  schemaVersion: '1.0.0',
  actor: {
    id: 'local-operator',
    displayName: 'Local Operator',
    roles: ['Local Operator'],
  },
  tenantId: 'tenant.local',
  serverBaseUrl: 'http://127.0.0.1:3000',
  storage: {
    dbFilePath: 'var/db/platform.sqlite',
    objectStoreDir: 'var/object-store',
  },
  platform: {
    runtimeMode: 'local',
    metadataStore: 'sqlite',
    objectStore: 'filesystem',
    queueBackend: 'in-process',
    telemetryBackend: 'stdout',
  },
  availableCommands: ['pnpm dev:api', 'pnpm dev:web'],
  readiness: {
    areas: [],
    overall: {
      localMvpReadiness: 89,
      pilotReadiness: 50,
    },
    remainingWork: [],
  },
};

const artifactDiffView = {
  schemaVersion: '1.0.0',
  runId: 'run.local.001',
  artifactType: 'story-workbook',
  comparisonStatus: 'diff-available',
  leftArtifactId: 'swb.local.000',
  rightArtifactId: 'swb.local.001',
  leftCreatedAt: '2026-04-22T11:30:00Z',
  rightCreatedAt: '2026-04-22T12:00:00Z',
  comparedAt: '2026-04-22T12:10:00Z',
  availableArtifacts: [
    {
      artifactId: 'swb.local.001',
      createdAt: '2026-04-22T12:00:00Z',
      status: 'generated',
    },
    {
      artifactId: 'swb.local.000',
      createdAt: '2026-04-22T11:30:00Z',
      status: 'generated',
    },
  ],
  summary: {
    changeCount: 1,
    addedCount: 1,
    removedCount: 0,
    changedCount: 0,
  },
  changes: [
    {
      path: 'sceneOutline[0].linkedClaimIds[1]',
      changeType: 'added',
      after: 'claim.local.002',
    },
  ],
};

function mockFetch(url: string) {
  const parsed = new URL(url, 'http://127.0.0.1:3000');

  if (parsed.pathname === '/api/v1/review-dashboard-view') {
    return Response.json(dashboardView);
  }

  if (parsed.pathname === '/api/v1/local-runtime-view') {
    return Response.json(localRuntimeView);
  }

  if (parsed.pathname === '/api/v1/review-queue') {
    return Response.json(queueView);
  }

  if (parsed.pathname === '/api/v1/review-queue/analytics') {
    return Response.json(queueAnalyticsView);
  }

  if (parsed.pathname === '/api/v1/notifications') {
    return Response.json(notifications);
  }

  if (parsed.pathname === '/api/v1/workflow-runs/run.local.001') {
    return Response.json(workflowRun);
  }

  if (parsed.pathname === '/api/v1/workflow-runs/run.local.001/review-run-view') {
    return Response.json(reviewRunView);
  }

  if (parsed.pathname === '/api/v1/workflow-runs/run.local.001/rendering-guide') {
    return Response.json(renderingGuideView);
  }

  if (parsed.pathname === '/api/v1/workflow-runs/run.local.001/clinical-package') {
    return Response.json(clinicalPackage);
  }

  if (parsed.pathname === '/api/v1/workflow-runs/run.local.001/evaluations') {
    return Response.json(evaluations);
  }

  if (parsed.pathname === '/api/v1/workflow-runs/run.local.001/exports') {
    return Response.json(reviewRunView.exportHistory.entries);
  }

  if (parsed.pathname === '/api/v1/workflow-runs/run.local.001/audit-log-entries') {
    return Response.json(auditEntries);
  }

  if (parsed.pathname === '/api/v1/workflow-runs/run.local.001/artifacts') {
    return Response.json(artifacts);
  }

  if (parsed.pathname === '/api/v1/workflow-runs/run.local.001/comments') {
    return Response.json(reviewRunView.reviewComments);
  }

  if (parsed.pathname === '/api/v1/workflow-runs/run.local.001/assignments') {
    return Response.json(reviewRunView.reviewAssignments);
  }

  if (parsed.pathname === '/api/v1/workflow-runs/run.local.001/artifact-diffs') {
    return Response.json(artifactDiffView);
  }

  if (parsed.pathname === '/api/v1/source-records') {
    return Response.json(clinicalPackage.sourceGovernance.sourceRecords);
  }

  if (parsed.pathname === '/api/v1/source-catalog') {
    return Response.json(clinicalPackage.sourceGovernance.sourceRecords);
  }

  if (parsed.pathname === '/api/v1/release-bundles/rel.local.001') {
    return Response.json({
      releaseId: 'rel.local.001',
      version: 'cap-local-1',
      bundleIndexLocation: '/api/v1/release-bundles/rel.local.001/index',
    });
  }

  if (parsed.pathname.endsWith('/approvals') || parsed.pathname.endsWith('/canonicalization-resolution') || parsed.pathname.endsWith('/rebuild') || parsed.pathname.endsWith('/governance-decisions') || parsed.pathname.endsWith('/contradiction-resolutions') || parsed.pathname.endsWith('/exports') || parsed.pathname.endsWith('/comments') || parsed.pathname.endsWith('/assignments') || parsed.pathname.endsWith('/rendering-guide/regenerate') || parsed.pathname.endsWith('/rendered-assets/attach') || parsed.pathname.endsWith('/threads') || parsed.pathname.includes('/review-threads/')) {
    return Response.json({});
  }

  throw new Error(`Unhandled fetch path in test: ${parsed.pathname}`);
}

function renderRoute(initialPath: string) {
  return render(
    <RefreshProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <AppRoutes />
      </MemoryRouter>
    </RefreshProvider>,
  );
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => Promise.resolve(mockFetch(String(input)))));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('web app routes', () => {
  it.each([
    ['/review', 'Review Dashboard'],
    ['/review/queue', 'Review Queue'],
    ['/runs/run.local.001/pipeline', 'Pipeline Page'],
    ['/runs/run.local.001/review', 'Review Page'],
    ['/runs/run.local.001/packets', 'Packets Page'],
    ['/runs/run.local.001/evidence', 'Evidence Page'],
    ['/runs/run.local.001/workbooks', 'Workbooks Page'],
    ['/runs/run.local.001/scenes', 'Scenes Page'],
    ['/runs/run.local.001/panels', 'Panels Page'],
    ['/runs/run.local.001/rendering-guide', 'Rendering Guide'],
    ['/runs/run.local.001/sources', 'Sources Page'],
    ['/runs/run.local.001/governance', 'Governance Page'],
    ['/runs/run.local.001/evals', 'Evals Page'],
    ['/runs/run.local.001/bundles', 'Bundles Page'],
    ['/settings', 'Settings Page'],
  ])('renders %s', async (route, heading) => {
    renderRoute(route);
    await waitFor(async () => {
      expect(await screen.findByText(heading)).toBeInTheDocument();
    });
  });

  it('shows export gating copy from live run data', async () => {
    renderRoute('/runs/run.local.001/bundles');
    await waitFor(async () => {
      expect(await screen.findByText('Bundles Page')).toBeInTheDocument();
    });
    expect(screen.queryByText(/Export is blocked until the latest eval run is fresh and passing/i)).not.toBeInTheDocument();
  });

  it('shows live reviewer assignments and comments on the review page', async () => {
    renderRoute('/runs/run.local.001/review');
    await waitFor(async () => {
      expect(await screen.findByText('Review assignments')).toBeInTheDocument();
    });
    expect(screen.getByText('Tie the opening panel more directly to the evidence claim.')).toBeInTheDocument();
    expect(screen.getAllByText('Local Operator').length).toBeGreaterThan(0);
  });

  it('shows the rendering guide page with OpenAI prompt content', async () => {
    renderRoute('/runs/run.local.001/rendering-guide');
    await waitFor(async () => {
      expect(await screen.findByText('Rendering Guide')).toBeInTheDocument();
    });
    expect(screen.getAllByText(/Secondary OpenAI Image support guide/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/OpenAI panel execution brief/i)).toBeInTheDocument();
  });
});
