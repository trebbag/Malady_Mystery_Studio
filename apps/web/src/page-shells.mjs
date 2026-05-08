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
    title: 'Home Dashboard',
    purpose: 'Starts a new disease run and resumes the most important existing run without exposing internal pipeline detail.',
    states: {
      loading: ['Loading local runs.', 'Loading next actions.'],
      empty: ['No local runs yet. Start with a disease name.'],
      creating: ['Creating the project.', 'Starting the workflow run.', 'Opening the run overview.'],
      ready: ['Home is ready for run creation or continuation.'],
      error: ['Failed to load the home dashboard.'],
    },
    banners: [
      'Keep the create-run action and top next action above all secondary metrics.',
      'Explain what happens after the start button before showing technical status.',
      'Avoid internal pipeline jargon on the first screen.',
    ],
    components: mapComponents(['ReviewDashboardShell', 'CreatorPrimaryActionCard']),
  },
  {
    path: '/runs',
    title: 'Runs',
    purpose: 'Shows all local disease comic runs with friendly status, next action, and blocker summary.',
    states: {
      loading: ['Loading local runs.'],
      empty: ['No local runs exist yet.'],
      filtered: ['Run filters applied.'],
      error: ['Failed to load runs.'],
    },
    banners: [
      'Each row should show the next useful action before technical state.',
      'Keep filters collapsed by default.',
    ],
    components: mapComponents(['ReviewDashboardShell', 'CreatorWorkflowStepper']),
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
    path: '/sources',
    title: 'Source Operations',
    purpose: 'Shows local source ownership, freshness, approval, and refresh burden without requiring a selected run.',
    states: {
      loading: ['Loading source operations.'],
      empty: ['No source records are visible yet.'],
      blocked: ['One or more sources are stale, suspended, contradicted, superseded, or ownerless.'],
      ready: ['Source operations are ready.'],
      error: ['Failed to load source operations.'],
    },
    banners: ['Keep source blockers and ownerless records clear before showing technical source payloads.'],
    components: mapComponents(['SourceGovernanceTable']),
  },
  {
    path: '/runs/:runId/overview',
    title: 'Run Overview',
    purpose: 'Shows a single next action, plain-language status, production path, blockers, and advanced links.',
    states: {
      loading: ['Loading creator workflow.'],
      blocked: ['The next action is blocked by a clinical, guide, render, eval, or export gate.'],
      ready: ['The next action is available.'],
      complete: ['The local release bundle is available.'],
      error: ['Failed to load the run overview.'],
    },
    banners: ['Show one primary action and one blocker explanation before any technical detail.'],
    components: mapComponents(['CreatorPrimaryActionCard', 'CreatorWorkflowStepper']),
  },
  {
    path: '/runs/:runId/clinical-review',
    title: 'Clinical Review',
    purpose: 'Guides the creator-operator through disease packet, evidence/source, traceability, and approval decisions.',
    states: {
      loading: ['Loading clinical review data.'],
      blocked: ['Clinical governance or traceability is blocking this run.'],
      reviewRequired: ['Clinical package needs local operator approval.'],
      approved: ['Clinical approvals are complete.'],
      error: ['Failed to load clinical review.'],
    },
    banners: ['Use plain-language clinical safety explanations before source metadata.'],
    components: mapComponents(['ClinicalPackageSection', 'TraceCoveragePanel', 'ApprovalActions']),
  },
  {
    path: '/runs/:runId/story-panel-plan',
    title: 'Story and Panel Plan',
    purpose: 'Shows mystery craft, fair-reveal proof, panel adaptation, page rhythm, and continuity readiness before guide approval.',
    states: {
      loading: ['Loading story craft and panel adaptation artifacts.'],
      blocked: ['A story or panel finding blocks visual approval.'],
      ready: ['Story and panel plan are ready for guide review.'],
      missingArtifacts: ['Story or panel artifacts have not been generated yet.'],
      error: ['Failed to load story and panel plan.'],
    },
    banners: [
      'Explain story and panel readiness before exposing raw workbook or panel JSON.',
      'Show blocking rule IDs only after the user-facing explanation.',
    ],
    components: mapComponents(['RunSummaryCard', 'CreatorWorkflowStepper']),
  },
  {
    path: '/runs/:runId/guide-review',
    title: 'Guide Review',
    purpose: 'Simplified pre-render approval page for the rendering guide and visual reference pack.',
    states: {
      loading: ['Loading rendering guide review.'],
      notReviewed: ['Rendering is disabled until guide/reference approval.'],
      changesRequested: ['Guide changes are required before rendering.'],
      approved: ['Rendering guide and visual references are approved.'],
      stale: ['Guide approval is stale after regeneration.'],
      error: ['Failed to load guide review.'],
    },
    banners: ['Cyto/Pip locks, reference coverage, lettering separation, and medical traceability must be understandable before approval.'],
    components: mapComponents(['CreatorPrimaryActionCard', 'RunSummaryCard']),
  },
  {
    path: '/runs/:runId/render-panels',
    title: 'Render Panels',
    purpose: 'Guides panel rendering from approved guide/reference provenance to rendered manifest completion.',
    states: {
      loading: ['Loading render state.'],
      renderDisabled: ['Rendering is disabled until the guide/reference gate is approved.'],
      ready: ['Panels are ready to render.'],
      running: ['A render job is in progress.'],
      completed: ['Rendered panel manifest is present.'],
      retryRequired: ['One or more panels need retry.'],
      error: ['Failed to load render state.'],
    },
    banners: ['Keep render-disabled reasons visible instead of hiding controls.'],
    components: mapComponents(['CreatorWorkflowStepper']),
  },
  {
    path: '/runs/:runId/export',
    title: 'Export',
    purpose: 'Shows final safety checks, rendered-panel set, local package, local mirror, and restore-smoke readiness.',
    states: {
      loading: ['Loading export readiness.'],
      blocked: ['Export is blocked by a missing gate.'],
      ready: ['Run is ready to export.'],
      exported: ['Release bundle exists.'],
      mirrored: ['Local delivery mirror has been verified.'],
      error: ['Failed to load export readiness.'],
    },
    banners: ['Explain export blockers in plain language before technical eval family details.'],
    components: mapComponents(['EvalRunPanel', 'ExportHistoryPanel']),
  },
  {
    path: '/runs/:runId/advanced',
    title: 'Advanced Details',
    purpose: 'Keeps the original technical pages available without making them the primary workflow.',
    states: {
      loading: ['Loading advanced route links.'],
      ready: ['Advanced links are ready.'],
      error: ['Failed to load advanced links.'],
    },
    banners: ['Technical pages are secondary and should not be the first interaction path.'],
    components: mapComponents(['RunSummaryCard']),
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
