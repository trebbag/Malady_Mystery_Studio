import assert from 'node:assert/strict';
import test from 'node:test';

import { createSchemaRegistry } from '../../../packages/shared-config/src/schema-registry.mjs';
import { findRepoRoot } from '../../../packages/shared-config/src/repo-paths.mjs';
import {
  createClinicalPackageView,
  createEvaluationSummaryView,
  createExportHistoryView,
  createLocalRuntimeView,
  createReviewDashboardView,
  createReviewRunView,
  createSourceGovernanceView,
  createTraceCoverageView,
  createWorkflowArtifactListView,
} from './view-model-adapters.mjs';
import { webRouteManifest } from './route-manifest.mjs';

const rootDir = findRepoRoot(import.meta.url);

test('route manifest exposes the required placeholder review routes', () => {
  assert.equal(webRouteManifest.some((route) => route.path === '/review'), true);
  assert.equal(webRouteManifest.some((route) => route.path === '/review/runs/:runId'), true);
  assert.equal(webRouteManifest.some((route) => route.path === '/review/runs/:runId/clinical-package'), true);
});

test('view-model adapters produce schema-valid placeholder payloads', async () => {
  const schemaRegistry = await createSchemaRegistry(rootDir);
  const traceCoverage = createTraceCoverageView({
    score: 1,
    verdict: 'passed',
    validClaimCount: 2,
    suspendedSourceCount: 0,
    staleSourceCount: 0,
    blockingContradictions: 0,
    artifactSummaries: [
      {
        artifactType: 'panel-plan',
        itemCount: 3,
        linkedItemCount: 3,
        validItemCount: 3,
        missingLinkCount: 0,
        invalidLinkCount: 0,
        coverageScore: 1,
      },
    ],
    blockers: [],
  });
  const sourceGovernance = createSourceGovernanceView({
    canonicalDiseaseName: 'Hepatocellular carcinoma',
    sourceRecords: [
      {
        schemaVersion: '1.0.0',
        id: 'src.hcc.guideline.001',
        canonicalDiseaseName: 'Hepatocellular carcinoma',
        sourceLabel: 'Curated hepatocellular carcinoma guideline',
        sourceType: 'guideline',
        sourceTier: 'tier-1',
        approvalStatus: 'approved',
        freshnessScore: 0.97,
        freshnessStatus: 'current',
        contradictionStatus: 'none',
        owner: 'clinical-board',
        governanceNotes: ['Preferred baseline source for the starter knowledge pack.'],
        sourceUrl: 'https://example.org/hcc-guideline',
        lastReviewedAt: '2026-04-20T00:00:00Z',
      },
    ],
    governanceDecisions: [
      {
        schemaVersion: '1.0.0',
        id: 'sgd.hcc.001',
        tenantId: 'tenant.local',
        sourceId: 'src.hcc.guideline.001',
        canonicalDiseaseName: 'Hepatocellular carcinoma',
        decision: 'approved',
        reason: 'Baseline source remains approved.',
        reviewedAt: '2026-04-22T11:30:00Z',
        decidedBy: 'local-operator',
        decidedByRoles: ['Local Operator'],
        occurredAt: '2026-04-22T11:30:00Z',
        notes: ['Keep this source active for Gate 2 packets.'],
      },
    ],
  });
  const clinicalPackage = createClinicalPackageView({
    runId: 'run.hcc.001',
    clinicalPackage: {
      canonicalDisease: {
        schemaVersion: '1.0.0',
        id: 'can.hcc.001',
        rawInput: 'hepatocellular carcinoma',
        normalizedInput: 'hepatocellular carcinoma',
        resolutionStatus: 'resolved',
        confidence: 0.99,
        canonicalDiseaseName: 'Hepatocellular carcinoma',
        aliases: ['HCC'],
        ontologyId: 'ICD-10-CM:C22.0',
        diseaseCategory: 'Oncology',
        candidateMatches: [
          {
            canonicalDiseaseName: 'Hepatocellular carcinoma',
            ontologyId: 'ICD-10-CM:C22.0',
            matchType: 'exact',
          },
        ],
        notes: 'Exact canonical disease match.',
      },
      diseasePacket: (await import('../../../examples/sample_disease_packet.json', { with: { type: 'json' } })).default,
      factTable: (await import('../../../examples/sample_fact_table.json', { with: { type: 'json' } })).default,
      evidenceGraph: (await import('../../../examples/sample_evidence_graph.json', { with: { type: 'json' } })).default,
      clinicalTeachingPoints: (await import('../../../examples/sample_clinical_teaching_points.json', { with: { type: 'json' } })).default,
      visualAnchorCatalog: (await import('../../../examples/sample_visual_anchor_catalog.json', { with: { type: 'json' } })).default,
      sourceRecords: sourceGovernance.sourceRecords,
      governanceDecisions: sourceGovernance.governanceDecisions,
      contradictionResolutions: [],
      traceCoverage,
    },
  });
  const latestEvalRun = (await import('../../../examples/sample_eval_run.json', { with: { type: 'json' } })).default;
  const evaluationSummary = createEvaluationSummaryView({
    latestEvalStatus: 'passed',
    latestEvalRun,
  });
  const exportHistory = createExportHistoryView({
    runId: 'run.hcc.001',
    entries: [
      (await import('../../../examples/sample_export_history_entry.json', { with: { type: 'json' } })).default,
    ],
  });
  const artifactListView = createWorkflowArtifactListView({
    runId: 'run.hcc.001',
    artifactTypeFilters: ['story-workbook'],
    expand: true,
    artifacts: [
      {
        artifactType: 'story-workbook',
        artifactId: 'swb.hcc.001',
        status: 'generated',
        path: 'tenant.local/story-workbook/swb.hcc.001.json',
        payload: {
          schemaVersion: '1.0.0',
          id: 'swb.hcc.001',
        },
      },
    ],
  });
  const localRuntimeView = createLocalRuntimeView({
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
      areas: [
        {
          label: 'Foundation and local runtime',
          percentComplete: 95,
        },
      ],
      overall: {
        localMvpReadiness: 85,
        pilotReadiness: 45,
      },
      remainingWork: ['live render integration'],
    },
  });
  const dashboard = createReviewDashboardView({
    workflowRuns: [
      {
        id: 'run.hcc.001',
        projectId: 'prj.hcc.001',
        input: {
          diseaseName: 'Hepatocellular carcinoma',
        },
        state: 'approved',
        currentStage: 'export',
        updatedAt: '2026-04-22T12:00:00Z',
      },
    ],
    projectsById: new Map([
      [
        'prj.hcc.001',
        {
          title: 'Hepatocellular carcinoma starter project',
          input: {
            diseaseName: 'Hepatocellular carcinoma',
          },
        },
      ],
    ]),
    runSummaries: new Map([
      [
        'run.hcc.001',
        {
          exportCount: 1,
          latestEvalStatus: 'passed',
        },
      ],
    ]),
    filters: {},
  });
  const reviewRun = createReviewRunView({
    project: {
      title: 'Hepatocellular carcinoma starter project',
    },
    workflowRun: {
      id: 'run.hcc.001',
      input: {
        diseaseName: 'Hepatocellular carcinoma',
      },
      state: 'review',
      currentStage: 'review',
      stages: [
        {
          name: 'review',
          status: 'running',
        },
      ],
    },
    clinicalPackage: {
      canonicalDisease: clinicalPackage.canonicalDisease,
      diseasePacket: clinicalPackage.diseasePacket,
      factTable: clinicalPackage.factTable,
      evidenceGraph: clinicalPackage.evidenceGraph,
      clinicalTeachingPoints: clinicalPackage.clinicalTeachingPoints,
      visualAnchorCatalog: clinicalPackage.visualAnchorCatalog,
      sourceRecords: sourceGovernance.sourceRecords,
      governanceDecisions: sourceGovernance.governanceDecisions,
      contradictionResolutions: [],
      traceCoverage,
    },
    latestEvalRun,
    latestEvalStatus: 'passed',
    exportHistory: exportHistory.entries,
  });

  schemaRegistry.assertValid('contracts/trace-coverage-view.schema.json', traceCoverage);
  schemaRegistry.assertValid('contracts/source-governance-view.schema.json', sourceGovernance);
  schemaRegistry.assertValid('contracts/clinical-package-view.schema.json', clinicalPackage);
  schemaRegistry.assertValid('contracts/evaluation-summary-view.schema.json', evaluationSummary);
  schemaRegistry.assertValid('contracts/export-history-view.schema.json', exportHistory);
  schemaRegistry.assertValid('contracts/workflow-artifact-list-view.schema.json', artifactListView);
  schemaRegistry.assertValid('contracts/local-runtime-view.schema.json', localRuntimeView);
  schemaRegistry.assertValid('contracts/review-dashboard-view.schema.json', dashboard);
  schemaRegistry.assertValid('contracts/review-run-view.schema.json', reviewRun);
});
