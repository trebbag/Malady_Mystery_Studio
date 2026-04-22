# Repository instructions

## Mission

Build a commercial-grade platform that turns a disease or condition into a medically accurate, narratively rich, panel-by-panel comic production package featuring two alien detectives.

## Start-of-task requirements

Before proposing changes, read:
1. `docs/master-spec.md`
2. `docs/repo-map.md`
3. the relevant ADR(s) in `docs/adr/`
4. the relevant schema(s) in `contracts/`
5. the relevant eval assets in `evals/`
6. the relevant ticket in `docs/backlog/tickets/`, if one exists

## Mandatory project rules

- Prefer **small, reviewable changes** over broad rewrites.
- Work **contract-first**. If behavior changes, update or add schemas before wiring the implementation.
- Never invent or silently mutate medical facts. Medical claims must remain traceable to approved evidence objects and reviewer workflows.
- Keep **art generation** and **lettering/text placement** as separate concerns.
- Preserve the franchise rules: mystery first, diagnosis earned, treatment as climax, wrap-up loop closes the opener.
- If a task changes agent behavior, prompts, orchestration, or evaluation logic, update **tests/evals/docs** in the same change.
- Do not bypass human review gates, release gates, or audit logging requirements.
- Prefer explicit state machines and typed contracts over hidden workflow conventions.
- When touching security, privacy, review, or data retention logic, read `security/` and `governance/` first.
- When a change introduces a breaking contract change, add or update an ADR and document the migration path.

## How to handle large tasks

For large tasks:
1. summarize the objective,
2. list affected files and services,
3. list affected schemas,
4. list affected evals,
5. propose the smallest safe implementation slice,
6. then implement.

## Completion checklist

Before finishing a task, confirm:
- schema changes are documented,
- acceptance criteria from the ticket are satisfied,
- examples and fixtures still validate,
- affected docs are updated,
- new failure modes are called out,
- release gates are not weakened.

## What to avoid

- giant all-at-once scaffolds with no tests or contracts
- hidden prompt strings spread through the codebase
- “magic” model behavior with no eval coverage
- medical shortcuts that collapse nuance for convenience
- render prompts that include large blocks of visible text
