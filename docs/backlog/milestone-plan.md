# Milestone plan

This plan is intentionally written as a sequence of **reviewable slices** rather than a giant build.

## M0 — Foundation and governance
Goal: create the repository, contracts, workflow lifecycle, validation, and review boundaries that the rest of the product will rely on.

Exit criteria:
- root repo scaffold exists
- critical schemas exist
- examples validate
- workflow states are defined
- auth/review gate stubs exist
- CI validates the pack

## M1 — Clinical intake and disease packet
Goal: turn a disease input into a validated disease packet with evidence traceability.

Exit criteria:
- disease intake API/UI path exists
- canonicalization interface exists
- evidence objects can be stored and retrieved
- a disease packet can be created, persisted, and inspected

## M2 — Narrative and mystery engine
Goal: convert a disease packet into a story workbook that obeys franchise and pedagogy rules.

Exit criteria:
- story workbook artifact exists
- sequencing guardrails implemented
- novelty/memory contract exists
- narrative review traces captured

## M3 — Scene, panel, and render preparation
Goal: convert the workbook into scenes, panels, and render-ready prompts.

Exit criteria:
- scene cards generated
- panel plan generated
- render prompts separated from lettering
- editorial review UI can inspect artifacts

## M4 — Evaluation, export, and release
Goal: operationalize quality.

Exit criteria:
- eval harness runs against datasets
- release bundle assembles artifacts
- approvals are captured
- export package can be produced

## Ticket inventory

See `docs/backlog/tickets/index.md`.
