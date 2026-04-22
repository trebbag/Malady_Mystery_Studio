# UI Component Map

These are placeholder component names that define the intended structure. A future UI-focused builder can replace them visually, split them, or merge them, but these responsibilities should remain visible in the final app.

## Core placeholders

- `ReviewDashboardShell`
  - wraps filters, stats, and the run table
- `RunSummaryCard`
  - shows project, disease, state, stage, pause reason, eval status, and export count
- `ClinicalPackageSection`
  - container for clinical summary subsections
- `FactTablePanel`
  - claim rows, support status, certainty, and source ids
- `EvidenceGraphPanel`
  - support and contradiction edges between claims and sources
- `SourceGovernanceTable`
  - current source record status and governance history
- `ContradictionResolutionPanel`
  - contradiction statuses and reviewer actions
- `TraceCoveragePanel`
  - downstream link coverage, blockers, and per-artifact summaries
- `ApprovalActions`
  - approval and rejection actions with disabled-state reasons
- `EvalRunPanel`
  - latest eval run, family scores, and release-gate verdicts
- `ExportHistoryPanel`
  - release history and bundle retrieval links
- `AuditLogPanel`
  - chronological workflow and governance events

## Placeholder interaction rules

- Export actions must show why they are disabled.
- Clinical governance controls must be visible before story-level controls when the run is blocked.
- Eval controls must distinguish `missing`, `failed`, and `stale`.
- Contradiction resolution actions should sit next to the contradiction row they affect.
- The run-detail view should keep clinical, story, eval, approval, and export sections visibly grouped rather than mixing them into one undifferentiated feed.
