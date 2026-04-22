# Evals area instructions

Work here when defining datasets, rubrics, thresholds, or evaluation runners.

## Rules

- Evals should reflect real product failure modes, not generic benchmark behavior.
- Keep datasets versioned and human-readable.
- Prefer multiple small eval families over one giant ambiguous score.
- Document what a passing score means operationally.
- When adding a new agent or prompt workflow, add or update at least one eval.

## Review questions

- What regression does this eval protect against?
- Is the dataset representative of production reality?
- Could a system game this eval without actually improving?
- Does the grader align with human reviewer judgment?
