# ADR 0008: Keep the rendering guide as a secondary QA and retry artifact

- **Status:** Accepted
- **Date:** 2026-04-23
- **Owners:** Product lead + Story systems lead
- **Decision type:** product + architecture

## Context

The platform already produces panel plans, render prompts, lettering maps, rendered-output artifacts, and a compiled rendering guide. Reviewers still need one place to inspect the full prompt set, continuity locks, lettering overlays, and retry guidance without digging through separate panel artifacts.

## Decision

Keep a first-class `rendering-guide` artifact, but make it a secondary QA and retry deliverable rather than the default shipped output. The guide is generated after panel planning, render-prompt generation, and lettering separation. It compiles:

- run summary and disease context,
- franchise and continuity rules,
- anatomy and mechanism locks,
- global negative constraints,
- one OpenAI image prompt block per panel,
- a run-level OpenAI execution brief,
- lettering overlay instructions,
- retry guidance for failed or weak panel generations.

Default release export now requires rendered panels plus fresh passing evals. The rendering guide remains attached as a secondary review artifact that can be copied, diffed, regenerated, and used for manual retries.

The rendering guide is also the required pre-render review object. A generated guide must be paired with a generated `visual-reference-pack`, reviewed by the local operator, and approved through a `render-guide-review-decision` before any rendered panel assets can be created or attached.

## Consequences

### Positive
- reviewers still get a single place to inspect prompts, continuity locks, and lettering overlays
- reviewers can approve or request changes before any image generation spends real provider calls
- retry guidance stays readable even when the render worker already produced panel art
- lettering and medical traceability remain governed inside the repo rather than drifting into external tools
- older guide-first and newer rendered-output runs remain readable under one support-artifact model

### Tradeoffs
- the guide must stay in sync with the real panel pipeline, or it becomes misleading
- support-artifact quality is still important for retries and manual QA even though it is no longer the export gate
- the product still depends on a reliable render runtime for its primary definition of done

## Alternatives considered

- keep the rendering guide as the default definition of done: rejected because the product must ship finished panels
- export only raw render prompts without a compiled guide: rejected because it is too fragmented for reliable handoff
