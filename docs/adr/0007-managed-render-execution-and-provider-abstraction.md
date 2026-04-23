# ADR 0007: Keep managed render execution as an optional secondary branch

- **Status:** Accepted
- **Date:** 2026-04-23
- **Owners:** Platform lead + Art systems lead
- **Decision type:** architecture

## Context

The platform already produces panel plans, render prompts, lettering maps, and now a first-class `rendering-guide`. Direct provider execution is no longer the default product path, but externally attached art and legacy managed render flows still need typed contracts, retry history, and provider abstraction so older runs remain readable.

## Decision

Keep a dedicated `render-execution` workflow stage and provider-abstracted render services only as an optional secondary branch. Prompt generation and lettering remain separate concerns, but the active export path now ends at a `rendering-guide` artifact. Rendered assets and manifests remain readable and attachable, but they are no longer required for default release export.

## Consequences

### Positive
- externally rendered assets remain first-class, reviewable, and attachable artifacts
- retry logic and failure reasons stay auditable for teams that still need managed render execution
- provider logic stays behind a stable render-service boundary
- the default product path no longer depends on vendor-specific runtime image generation

### Tradeoffs
- managed render infrastructure still exists in the codebase and must be maintained as a secondary path
- teams can confuse optional rendered-output quality with the default guide-first release path if docs drift
- provider-specific failure modes remain a maintenance cost even though they are no longer core to MVP completion

## Alternatives considered
- remove render execution entirely: rejected because externally attached assets and older rendered runs still need typed support
- wire provider calls directly inside the review/export flow: rejected because it couples workflow logic to one vendor and obscures retries
