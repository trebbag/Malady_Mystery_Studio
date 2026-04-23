# ADR 0007: Keep managed render execution as the primary panel-delivery branch behind a provider abstraction

- **Status:** Accepted
- **Date:** 2026-04-23
- **Owners:** Platform lead + Art systems lead
- **Decision type:** architecture

## Context

The platform already produces panel plans, render prompts, lettering maps, and a first-class `rendering-guide`. The product now treats actual rendered panels as the default finished output again, while keeping the render provider behind a stable abstraction so the workflow, QA, and export contracts do not collapse into vendor-specific code.

## Decision

Keep a dedicated `render-execution` workflow stage and provider-abstracted render services as the default visual-delivery branch. Prompt generation and lettering remain separate concerns. The active export path now ends at a rendered-asset manifest, while the `rendering-guide` remains a secondary support artifact for QA, retries, and manual reuse.

## Consequences

### Positive
- rendered panel assets remain first-class, reviewable, and exportable artifacts
- retry logic and failure reasons stay auditable for teams that still need managed render execution
- provider logic stays behind a stable render-service boundary
- the system can swap image providers later without rewriting workflow or review semantics

### Tradeoffs
- managed render infrastructure is back on the critical path and must be kept reliable
- provider-specific failure modes are again part of release readiness
- docs and UI must stay clear that the rendering guide is a support artifact, not the shipped end product

## Alternatives considered
- remove render execution entirely: rejected because the product must ship finished panels, not just prompts
- wire provider calls directly inside the review/export flow: rejected because it couples workflow logic to one vendor and obscures retries
