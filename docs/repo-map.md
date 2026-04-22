# Repository map

This document explains what each top-level directory is for and how Codex and human developers should use it.

## Top level

### `AGENTS.md`
Short repository-wide instructions. Keep it concise. Put durable rules here, not the entire product vision.

### `.github/`
CI workflows and repository automation. Keep quality gates here so pull requests enforce the same checks used locally.

### `docs/`
Product, architecture, operational, and planning documents. The canonical long-form spec lives here.

### `docs/adr/`
Architecture Decision Records. Use ADRs when making durable technical decisions or introducing breaking changes.

### `docs/backlog/`
Milestone plan and ticket-sized work items. These are written so Codex can execute them one at a time.

### `docs/prompts/`
Copy-ready prompts for planning, implementation, review, and release-readiness checks.

### `contracts/`
Canonical machine-readable contracts. Every major artifact should have a schema here before or as it is implemented.

### `api/`
External API contract starter. The OpenAPI file should track the product-facing workflow, not internal implementation details.

### `evals/`
Datasets, rubrics, thresholds, and evaluation registry. This is where the project encodes what “good” means.

### `examples/`
Valid example artifacts that exercise the contracts and help developers understand intended structure.

### `scripts/`
Repository validation and utility scripts.

### `apps/`
User-facing applications. Typical future contents:
- `apps/web` — editorial UI placeholder/prep layer with route manifests, page shells, component map, and screen-shaped view models
- `apps/admin` — governance/admin console

### `services/`
Back-end services and workers. Typical future contents:
- orchestrator
- intake API
- clinical retrieval, including local governed knowledge packs under `services/clinical-retrieval/knowledge-packs`
- story engine
- render prep
- export service

### `packages/`
Shared libraries and utilities. Typical future contents:
- shared UI components
- shared config
- common client SDKs
- prompt registry helpers

### `security/`
Threat model, data classification, privacy posture, and secure engineering notes.

### `governance/`
Approval matrix, release checklist, and source governance rules.

### `infra/`
Infrastructure notes and deployment scaffolding.

## Working conventions

- Schemas and evals are first-class artifacts, not afterthoughts.
- Medical source traceability is required for publishable content.
- Prompt strings should eventually live in a registry or prompt package, not scattered in code.
- Large behavioral changes should reference:
  - at least one ticket,
  - at least one contract,
  - at least one eval,
  - and any relevant ADRs.
