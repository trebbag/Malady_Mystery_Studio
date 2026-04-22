# Contracts area instructions

Work here when defining or updating machine-readable schemas.

## Rules

- Prefer additive changes over breaking changes.
- If a breaking change is necessary, document it in an ADR and note migration expectations.
- Keep schemas strict enough to be useful: use required fields and `additionalProperties: false` where practical.
- Include examples somewhere in `examples/` for every major schema.
- When a schema changes, review:
  - `api/openapi.yaml`
  - `examples/`
  - `evals/`
  - relevant ticket docs

## Do not

- encode UI-only presentation concerns into core artifact contracts
- hide medically meaningful facts inside free-form strings when structure is possible
- weaken schemas just to make generation easier
