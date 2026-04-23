# ADR 0008: Make the rendering guide the default final visual artifact

- **Status:** Accepted
- **Date:** 2026-04-23
- **Owners:** Product lead + Story systems lead
- **Decision type:** product + architecture

## Context

The platform already produces panel plans, render prompts, lettering maps, and optional rendered-output artifacts. The product now needs a reliable handoff package that can be given to external AI tools without forcing in-app provider execution. The default output should remain medically traceable, franchise-safe, and readable even when no rendered assets are attached back to the run.

## Decision

Make a first-class `rendering-guide` artifact the default final visual deliverable for a workflow run. The guide is generated after panel planning, render-prompt generation, and lettering separation. It compiles:

- run summary and disease context,
- franchise and continuity rules,
- anatomy and mechanism locks,
- global negative constraints,
- one Nano Banana Pro prompt block per panel,
- one Genspark AI Slides block per panel,
- a deck-level Genspark bootstrap prompt,
- lettering overlay instructions,
- retry guidance for failed external generations.

Default release export now requires a valid `rendering-guide` plus fresh passing evals. `rendered-asset` and `rendered-asset-manifest` artifacts remain optional, manually attachable secondary artifacts.

## Consequences

### Positive
- the app can finish a run without directly calling an image provider
- exported output is easier to review, copy, diff, and hand off externally
- lettering and medical traceability remain governed inside the repo rather than drifting into external tools
- older rendered-output runs remain readable while newer guide-first runs become the norm

### Tradeoffs
- the product no longer guarantees final bitmap output inside the app
- prompt quality and guide quality become more important than provider-runtime success
- external handoff quality depends on how faithfully outside tools follow the guide

## Alternatives considered

- keep rendered-output completion as the default definition of done: rejected because it over-couples MVP value to a provider runtime
- export only raw render prompts without a compiled guide: rejected because it is too fragmented for reliable handoff
