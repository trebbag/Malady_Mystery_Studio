export const webComponentMap = [
  {
    name: 'ReviewDashboardShell',
    purpose: 'Wraps dashboard filters, stats, and the run table.',
    feeds: ['contracts/review-dashboard-view.schema.json'],
  },
  {
    name: 'RunSummaryCard',
    purpose: 'Shows project, disease, workflow state, stage, pause reason, and latest eval state.',
    feeds: ['contracts/review-run-view.schema.json'],
  },
  {
    name: 'ClinicalPackageSection',
    purpose: 'Container for disease packet, fact table, graph, teaching, anchors, and governance subsections.',
    feeds: ['contracts/clinical-package-view.schema.json'],
  },
  {
    name: 'FactTablePanel',
    purpose: 'Displays claim rows, certainty, support status, and source ids.',
    feeds: ['contracts/fact-table.schema.json'],
  },
  {
    name: 'EvidenceGraphPanel',
    purpose: 'Displays claim nodes and contradiction/support edges.',
    feeds: ['contracts/evidence-graph.schema.json'],
  },
  {
    name: 'SourceGovernanceTable',
    purpose: 'Shows current source state and historical governance decisions.',
    feeds: ['contracts/source-governance-view.schema.json'],
  },
  {
    name: 'ContradictionResolutionPanel',
    purpose: 'Shows contradiction edges and local actions to resolve or downgrade them.',
    feeds: ['contracts/contradiction-resolution.schema.json', 'contracts/evidence-graph.schema.json'],
  },
  {
    name: 'TraceCoveragePanel',
    purpose: 'Shows downstream trace coverage score, blockers, and per-artifact coverage.',
    feeds: ['contracts/trace-coverage-view.schema.json'],
  },
  {
    name: 'ApprovalActions',
    purpose: 'Surface review, approval, and rejection actions with explicit disabled reasons.',
    feeds: ['contracts/review-run-view.schema.json'],
  },
  {
    name: 'EvalRunPanel',
    purpose: 'Shows latest eval state, family scores, and gate outcomes.',
    feeds: ['contracts/evaluation-summary-view.schema.json'],
  },
  {
    name: 'ExportHistoryPanel',
    purpose: 'Shows release history, bundle links, and export readiness.',
    feeds: ['contracts/export-history-view.schema.json'],
  },
  {
    name: 'AuditLogPanel',
    purpose: 'Displays workflow and governance audit events in chronological order.',
    feeds: ['contracts/audit-log-entry.schema.json'],
  },
];
