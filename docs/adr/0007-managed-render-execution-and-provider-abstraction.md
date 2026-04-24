# ADR 0007: Keep local render execution as the primary panel-delivery branch behind a provider abstraction

- **Status:** Accepted
- **Date:** 2026-04-23
- **Owners:** Platform lead + Art systems lead
- **Decision type:** architecture

## Context

The platform already produces panel plans, render prompts, lettering maps, and a first-class `rendering-guide`. The product now treats actual rendered panels as the default finished output again, while keeping the render provider behind a stable abstraction so the workflow, QA, and export contracts do not collapse into vendor-specific code.

## Decision

Keep a dedicated `render-execution` workflow stage and provider-abstracted render services as the default visual-delivery branch. Prompt generation and lettering remain separate concerns. The active export path now ends at a rendered-asset manifest, while the `rendering-guide` remains a secondary support artifact for QA, retries, and manual reuse.

Render execution is not allowed to start automatically from prompt generation. Every provider path, including local stub rendering, OpenAI `gpt-image-2`, retry orchestration, manual external-art attachment, and future reference-image generation, must first prove that the latest guide and visual reference pack have a current approved review decision.

## Consequences

### Positive
- rendered panel assets remain first-class, reviewable, and exportable artifacts
- retry logic and failure reasons stay auditable while the app remains local-storage based
- provider logic stays behind a stable render-service boundary
- the system can swap image providers later without rewriting workflow or review semantics
- render provenance can prove which approved guide and visual reference pack were used for generated panels

### Tradeoffs
- OpenAI/stub render execution is on the delivery path, but generated artifacts and queue state remain local
- provider-specific failure modes are again part of release readiness
- docs and UI must stay clear that the rendering guide is a support artifact, not the shipped end product
- reviewers must complete one additional gate before panel rendering starts

## Alternatives considered
- remove render execution entirely: rejected because the product must ship finished panels, not just prompts
- wire provider calls directly inside the review/export flow: rejected because it couples workflow logic to one vendor and obscures retries
