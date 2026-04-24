# ADR 0011: Require pre-render guide review and visual reference approval

- **Status:** Accepted
- **Date:** 2026-04-24
- **Owners:** Product lead + Art systems lead + Clinical review lead
- **Decision type:** product + architecture

## Context

The product’s end result is once again rendered panel art, but the user must be able to inspect the full development and rendering guide before any image generation starts. Character consistency for Detective Cyto Kine and Deputy Pip, recurring props, set pieces, anatomy environments, lettering separation, and claim traceability all need a reviewable checkpoint before the app spends real OpenAI image calls or creates local stub assets.

## Decision

Add a hard `render-guide-review-required` pause after `render-prep` and before `render-execution`. Generate a `visual-reference-pack` alongside every `rendering-guide`, then require a current approved `render-guide-review-decision` before any render job, retry, manual rendered-asset attachment, or future reference-image generation can proceed.

The approved guide/reference pair becomes render provenance. `render-job` and `rendered-asset-manifest` records must capture the `renderingGuideId` and `visualReferencePackId` used for generation, and export gates must reject rendered assets that do not match the latest approved pair.

## Consequences

### Positive
- no stub, OpenAI, retry, or attachment path can bypass reviewer approval
- Cyto and Pip have explicit visual and personality locks before panel rendering
- recurring props and set pieces are extracted into reusable reference items before panels depend on them
- rendered output can be traced back to the exact approved guide/reference pack
- the UI can show disabled render controls with an explicit reason instead of hiding them

### Tradeoffs
- first render is one review step later than prompt generation
- old rendered runs remain readable but need current approval before new render, retry, or export actions
- guide/reference regeneration invalidates approval and requires another review decision

## Alternatives considered

- allow local stub rendering before approval: rejected because it hides the real render gate in tests and could normalize bypass behavior
- make the rendering guide the final deliverable again: rejected because the product direction is finished panels
- only review individual panel prompts: rejected because character, prop, set-piece, and franchise consistency are run-level concerns
