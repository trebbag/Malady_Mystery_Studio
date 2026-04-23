# ADR 0007: Add managed render execution with provider abstraction

- **Status:** Accepted
- **Date:** 2026-04-23
- **Owners:** Platform lead + Art systems lead
- **Decision type:** architecture

## Context

The platform already produces panel plans, render prompts, and lettering maps, but pilot-ready release bundles need actual rendered assets, retry history, and audit-backed output approval. The product also needs a managed execution path for render jobs and a way to swap providers without rewriting workflow logic.

## Decision

Add a dedicated `render-execution` workflow stage with provider-abstracted render services, typed render contracts, async queue execution, and rendered-asset manifests. Gemini Image is the first live provider. Prompt generation and lettering remain separate concerns, and pilot-ready exports require rendered-output completion instead of prompt-only readiness.

## Consequences

### Positive
- rendered assets become first-class, reviewable, and exportable artifacts
- retry logic and failure reasons become auditable
- provider logic stays behind a stable render-service boundary
- future providers can be added without changing the surrounding workflow contracts

### Tradeoffs
- pilot infrastructure now needs queueing, object storage, and worker execution
- render-output review adds another gate before export
- provider-specific failure modes and operational cost controls become part of the runtime surface

## Alternatives considered
- keep prompt-only output for pilot export: rejected because it does not satisfy the intended production package
- wire provider calls directly inside the review/export flow: rejected because it couples workflow logic to one vendor and obscures retries
