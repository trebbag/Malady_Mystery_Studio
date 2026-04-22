# ADR 0001: Use a monorepo with contract-first development

- **Status:** Accepted
- **Date:** 2026-04-21
- **Owners:** Product + Engineering leadership
- **Decision type:** architecture

## Context

The platform spans UI, orchestration, retrieval, prompt management, evaluation, review, and export. The interfaces between these layers matter as much as the code inside them. A fragmented repository structure would make it harder for Codex and human engineers to evolve these interfaces safely.

## Decision

Use a single monorepo for the platform and require contract-first development for major artifacts and APIs. Schemas and eval assets are first-class source files in the repository root.

## Consequences

### Positive
- easier cross-layer refactors
- one source of truth for schemas and evals
- Codex can read the whole project context
- simpler release coordination for a small/medium team

### Tradeoffs
- stronger need for conventions and review discipline
- CI must scale with the repo over time

## Alternatives considered
- multi-repo by service: rejected for initial stage because cross-cutting contracts dominate
- code-first APIs with late schema generation: rejected because AI workflows need explicit contracts early
