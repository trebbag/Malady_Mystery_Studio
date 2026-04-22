# Traceability matrix

| Requirement domain | Primary contracts | Primary evals | Primary tickets | Release gate |
|---|---|---|---|---|
| Disease intake and canonicalization | `disease-intake-request`, `project`, `canonical-disease`, `canonicalization-resolution`, `workflow-run` | medical accuracy datasets | T101, T102 | Gate 2 |
| Medical evidence assembly and source governance | `disease-knowledge-pack`, `source-catalog-entry`, `source-governance-decision`, `evidence-record`, `source-record`, `fact-table`, `evidence-graph`, `clinical-teaching-points`, `visual-anchor-catalog`, `disease-packet` | medical accuracy + evidence traceability + governance release | T103, T104 | Gate 2, Gate 5 |
| Mystery structure | `story-workbook`, `narrative-review-trace`, `qa-report` | mystery quality + educational sequencing datasets | T201, T202, T204 | Gate 3 |
| Distinctive story generation | `story-workbook`, `story-memory`, `narrative-review-trace` | mystery quality + novelty | T203 | Gate 3 |
| Scene planning | `scene-card`, `qa-report` | panelization datasets | T301 | Gate 4 |
| Panel-by-panel output with traceability | `panel-plan`, `render-prompt`, `lettering-map`, `qa-report` | panelization + render readiness + evidence traceability | T302, T303 | Gate 4 |
| Local review and approvals | `approval-decision`, `canonicalization-resolution`, `audit-log-entry`, `workflow-run`, `qa-report`, `eval-run`, `clinical-package-view`, `review-run-view` | governance release + evidence traceability + panelization + render readiness | T005, T304, T401 | Gate 4, Gate 6 |
| Export and release bundles | `release-bundle`, `export-history-entry`, `eval-run` | governance release rubric | T401, T402 | Gate 5, Gate 6 |
| Frontend placeholder and handoff prep | `review-dashboard-view`, `review-run-view`, `clinical-package-view`, `evaluation-summary-view`, `export-history-view`, `source-governance-view`, `trace-coverage-view` | none directly; backed by the same run/eval artifacts | T304 follow-through | n/a |
