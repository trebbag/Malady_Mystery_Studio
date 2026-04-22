# Traceability matrix

| Requirement domain | Primary contracts | Primary evals | Primary tickets | Release gate |
|---|---|---|---|---|
| Disease intake and canonicalization | `disease-intake-request`, `project`, `canonical-disease`, `canonicalization-resolution`, `workflow-run` | medical accuracy datasets | T101, T102 | Gate 2 |
| Medical evidence traceability and source governance | `evidence-record`, `source-record`, `disease-packet`, `qa-report` | medical accuracy + governance | T103, T104 | Gate 2, Gate 5 |
| Mystery structure | `story-workbook`, `narrative-review-trace`, `qa-report` | mystery quality + educational sequencing datasets | T201, T202, T204 | Gate 3 |
| Distinctive story generation | `story-workbook`, `story-memory`, `narrative-review-trace` | mystery quality + novelty | T203 | Gate 3 |
| Scene planning | `scene-card`, `qa-report` | panelization datasets | T301 | Gate 4 |
| Panel-by-panel output | `panel-plan`, `render-prompt`, `lettering-map`, `qa-report` | panelization + render datasets | T302, T303 | Gate 4 |
| Human review, sessions, and approvals | `approval-decision`, `canonicalization-resolution`, `audit-log-entry`, `user-account`, `auth-session`, `narrative-review-trace`, `qa-report`, `release-bundle` | governance rubric | T005, T204, T304, T402 | Gate 6 |
| Export and release bundles | `release-bundle`, `export-history-entry` | release readiness rubric | T402 | Gate 1, Gate 6 |
