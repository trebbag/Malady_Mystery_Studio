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
    exportStatus: '',
    evalStatus: '',
    sort: 'updated-desc',
  },
  stats: {
    visibleRunCount: 1,
    blockedClinicalRunCount: 0,
    awaitingReviewCount: 1,
    staleEvalCount: 0,
    exportReadyCount: 0,
  },
  runs: [
    {
      runId: 'run.local.001',
      projectTitle: 'Community-acquired pneumonia starter project',
      diseaseName: 'Community-acquired pneumonia',
      state: 'review',
      currentStage: 'review',
      latestEvalStatus: 'passed',
      exportCount: 1,
      updatedAt: '2026-04-22T12:00:00Z',
    },
  ],
};

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
        sourceLabel: 'Starter source',
        sourceUrl: 'https://example.org/source',
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

function mockFetch(url: string) {
  const parsed = new URL(url, 'http://127.0.0.1:3000');

  if (parsed.pathname === '/api/v1/review-dashboard-view') {
    return Response.json(dashboardView);
  }

  if (parsed.pathname === '/api/v1/local-runtime-view') {
    return Response.json(localRuntimeView);
  }

  if (parsed.pathname === '/api/v1/workflow-runs/run.local.001') {
    return Response.json(workflowRun);
  }

  if (parsed.pathname === '/api/v1/workflow-runs/run.local.001/review-run-view') {
    return Response.json(reviewRunView);
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

  if (parsed.pathname === '/api/v1/source-records') {
    return Response.json(clinicalPackage.sourceGovernance.sourceRecords);
  }

  if (parsed.pathname === '/api/v1/release-bundles/rel.local.001') {
    return Response.json({
      releaseId: 'rel.local.001',
      version: 'cap-local-1',
      bundleIndexLocation: '/api/v1/release-bundles/rel.local.001/index',
    });
  }

  if (parsed.pathname.endsWith('/approvals') || parsed.pathname.endsWith('/canonicalization-resolution') || parsed.pathname.endsWith('/rebuild') || parsed.pathname.endsWith('/governance-decisions') || parsed.pathname.endsWith('/contradiction-resolutions') || parsed.pathname.endsWith('/exports')) {
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
    ['/runs/run.local.001/pipeline', 'Pipeline Page'],
    ['/runs/run.local.001/review', 'Review Page'],
    ['/runs/run.local.001/packets', 'Packets Page'],
    ['/runs/run.local.001/evidence', 'Evidence Page'],
    ['/runs/run.local.001/workbooks', 'Workbooks Page'],
    ['/runs/run.local.001/scenes', 'Scenes Page'],
    ['/runs/run.local.001/panels', 'Panels Page'],
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
});
