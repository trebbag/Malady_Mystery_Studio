# Evals

This directory defines how the project measures quality.

## Eval families

- `medical_accuracy`
- `evidence_traceability`
- `mystery_integrity`
- `educational_sequencing`
- `panelization`
- `render_readiness`
- `governance_release`

## Rules

- Evals should reflect the product’s real failure modes.
- Thresholds should be tied to release gates.
- Human review calibration matters; do not trust automated graders blindly.
- New prompts or workflow changes should add or update eval coverage.

## Files

- `thresholds.yaml`
- `datasets/*.jsonl`
- `graders/*.md`
- `registry.yaml`

## Local runner

- Run one workflow run locally with `pnpm eval:run -- --run-id <runId>`.
- API callers can use `POST /api/v1/workflow-runs/{runId}/evaluations`.
- Results persist as `eval-run` artifacts and are used to gate export.

## Adding or changing evals

- Add dataset rows to the family JSONL file in `datasets/`.
- Update `registry.yaml` if a new dataset file is introduced.
- Update `thresholds.yaml` when release expectations change.
- Keep graders deterministic in code for the local runner; do not rely on free-form LLM grading in this batch.
