import { webComponentMap } from './component-map.mjs';
import { webRouteManifest } from './route-manifest.mjs';

const componentMapByName = new Map(webComponentMap.map((component) => [component.name, component]));

/**
 * @param {string[]} names
 * @returns {any[]}
 */
function mapComponents(names) {
  return names.map((name) => {
    const component = componentMapByName.get(name);

    return {
      name,
      purpose: component?.purpose ?? 'Placeholder component slot.',
      feeds: component?.feeds ?? [],
    };
  });
}

export const webPageShells = [
  {
    path: '/intake',
    title: 'Local Intake Workspace',
    purpose: 'Captures the disease request and starts a local workflow run.',
    states: {
      loading: ['Loading project defaults.', 'Starting workflow run.'],
      empty: ['No draft intake request yet.'],
      success: ['Project created.', 'Workflow run started.'],
      error: ['Project creation failed.', 'Workflow run start failed.'],
    },
    banners: ['Local-open runtime. Actions are recorded as local-operator.'],
    components: mapComponents(['RunSummaryCard']),
  },
  {
    path: '/review',
    title: 'Review Dashboard',
    purpose: 'Shows the local review queue with filterable workflow runs and operational counts.',
    states: {
      loading: ['Loading workflow runs.', 'Loading eval and export summaries.'],
      empty: ['No workflow runs match the current filters.'],
      filtered: ['Dashboard filters applied.'],
      error: ['Failed to load the review dashboard.'],
    },
    banners: [
      'Highlight clinical blockers first.',
      'Make stale evals and export-ready runs visually obvious.',
    ],
    components: mapComponents(['ReviewDashboardShell', 'RunSummaryCard']),
  },
  {
    path: '/review/queue',
    title: 'Review Queue',
    purpose: 'Shows cross-run work items, queue pressure, overdue badges, and escalation context.',
    states: {
      loading: ['Loading work items.', 'Loading due-date summaries.'],
      empty: ['No work items match the current filters.'],
      filtered: ['Queue filters applied.'],
      error: ['Failed to load the review queue.'],
    },
    banners: [
      'Make overdue and escalated work visually prominent.',
      'Show queue origin so reviewers know whether the item came from clinical, render, or export flow.',
    ],
    components: mapComponents(['ReviewDashboardShell', 'RunSummaryCard']),
  },
  {
    path: '/runs/:runId/pipeline',
    title: 'Pipeline Timeline',
    purpose: 'Shows stage progression, artifact status, and audit history for a single run.',
    states: {
      loading: ['Loading run timeline.', 'Loading artifact status.'],
      blocked: ['Run is paused on a gate or blocker.'],
      ready: ['Run timeline ready for inspection.'],
      error: ['Failed to load pipeline details.'],
    },
    banners: [
      'Keep the current stage and pause reason visible above the timeline.',
      'Show which artifacts are required before export can continue.',
    ],
    components: mapComponents(['RunSummaryCard', 'AuditLogPanel']),
  },
  {
    path: '/runs/:runId/review',
    title: 'Run Review Workspace',
    purpose: 'Primary run-centric workspace for approvals, comments, work items, evals, and export readiness.',
    states: {
      loading: ['Loading run review state.', 'Loading assignments and comments.'],
      blocked: ['Clinical or export blockers need reviewer action.'],
      reviewReady: ['Run is ready for reviewer actions.'],
      exportReady: ['Run is export-ready.'],
      error: ['Failed to load the run review workspace.'],
    },
    banners: [
      'Highlight stale evals and export blockers before secondary metadata.',
      'Show threaded review and work-item context alongside approval controls.',
    ],
    components: mapComponents(['RunSummaryCard', 'ApprovalActions', 'EvalRunPanel', 'ExportHistoryPanel']),
  },
  {
    path: '/runs/:runId/rendering-guide',
    title: 'Rendering Guide Workbench',
    purpose: 'Reviews the full pre-render guide, Cyto/Pip locks, visual reference pack, panel prompts, lettering separation, and gate approval before any rendering can run.',
    states: {
      loading: ['Loading rendering guide.', 'Loading panel prompt blocks.'],
      guideOnly: ['Rendering guide is available but rendering remains disabled until approval.'],
      approved: ['Rendering guide and visual references are approved; panel rendering controls are enabled.'],
      externalArtAttached: ['Externally rendered art has been attached to this run.'],
      error: ['Failed to load the rendering guide.'],
    },
    banners: [
      'Keep lettering separation explicit in every panel block.',
      'Show manual external-art attachment as optional rather than required.',
    ],
    components: mapComponents(['RunSummaryCard', 'ExportHistoryPanel']),
  },
  {
    path: '/review/runs/:runId',
    title: 'Review Run',
    purpose: 'Primary local run-detail page for clinical review, approvals, evals, and export actions.',
    states: {
      loading: ['Loading workflow run.', 'Loading clinical package.', 'Loading audit history.'],
      blocked: ['Clinical governance is blocking story generation.', 'Eval results are stale or failing.'],
      reviewReady: ['Run is ready for human review actions.'],
      exportReady: ['Run has passing evals and can be exported.'],
      error: ['Failed to load the workflow run.'],
    },
    banners: [
      'Show pause reason prominently when the run is blocked.',
      'Disable export until the latest eval run is fresh and passing.',
    ],
    components: mapComponents([
      'RunSummaryCard',
      'ClinicalPackageSection',
      'ApprovalActions',
      'EvalRunPanel',
      'ExportHistoryPanel',
      'AuditLogPanel',
    ]),
  },
  {
    path: '/review/runs/:runId/clinical-package',
    title: 'Clinical Package Review',
    purpose: 'Dedicated clinical traceability page for governed evidence, contradictions, and source actions.',
    states: {
      loading: ['Loading clinical package artifacts.'],
      governanceBlocked: ['Blocking source governance issue detected.'],
      reviewRequired: ['Clinical package requires human review before story generation.'],
      ready: ['Clinical package ready for downstream work.'],
      error: ['Failed to load the clinical package.'],
    },
    banners: [
      'Surface blocked or stale sources before any story artifact details.',
      'Contradiction status must be obvious without opening a modal.',
    ],
    components: mapComponents([
      'ClinicalPackageSection',
      'FactTablePanel',
      'EvidenceGraphPanel',
      'SourceGovernanceTable',
      'ContradictionResolutionPanel',
      'TraceCoveragePanel',
    ]),
  },
  {
    path: '/review/runs/:runId/evaluations',
    title: 'Evaluation Summary',
    purpose: 'Shows the latest eval run, family scores, gate state, and rerun action.',
    states: {
      missing: ['No eval run has been recorded yet.'],
      running: ['Evaluations are in progress.'],
      passed: ['Latest eval run passed all thresholds.'],
      failed: ['One or more eval families failed threshold.'],
      stale: ['Latest eval run is stale relative to downstream artifacts.'],
    },
    banners: ['Export depends on a fresh passing eval run.'],
    components: mapComponents(['EvalRunPanel']),
  },
  {
    path: '/review/runs/:runId/exports',
    title: 'Export History',
    purpose: 'Shows release history, bundle retrieval links, and export readiness state.',
    states: {
      empty: ['No release bundles have been created yet.'],
      loading: ['Loading export history.'],
      ready: ['Release bundles available for retrieval.'],
      error: ['Failed to load export history.'],
    },
    banners: ['Keep release gating reasons visible when export is disabled.'],
    components: mapComponents(['ExportHistoryPanel']),
  },
  {
    path: '/review/releases/:releaseId',
    title: 'Release Bundle Detail',
    purpose: 'Shows a single release bundle, quality summary, and artifact manifest.',
    states: {
      loading: ['Loading release bundle.'],
      ready: ['Release bundle ready for inspection.'],
      error: ['Failed to load release bundle.'],
    },
    banners: ['Quality summary should call out evidence traceability explicitly.'],
    components: mapComponents(['ExportHistoryPanel', 'EvalRunPanel']),
  },
  {
    path: '/review/sources/:sourceId',
    title: 'Source Governance Detail',
    purpose: 'Shows one governed source record with its decision history and current operational status.',
    states: {
      loading: ['Loading source governance details.'],
      ready: ['Source governance details available.'],
      error: ['Failed to load source governance details.'],
    },
    banners: ['Show freshness, contradiction, and approval status together.'],
    components: mapComponents(['SourceGovernanceTable']),
  },
];
