# Evals

This directory defines how the project measures quality.

## Eval families

- `medical_accuracy`
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
