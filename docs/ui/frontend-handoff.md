# Frontend Handoff

This repo currently contains a backend/runtime and a frontend placeholder/prep layer. The placeholder layer exists so another AI or frontend specialist can see what must be built without reverse-engineering raw backend artifacts.

## What is fixed

- The route inventory in `apps/web/src/route-manifest.mjs`
- The named placeholder responsibilities in `apps/web/src/component-map.mjs`
- The per-route states, banners, and component slots in `apps/web/src/page-shells.mjs`
- The screen-shaped view contracts in `contracts/*-view.schema.json`
- The adapter boundary in `apps/web/src/view-model-adapters.mjs`

## What is intentionally open

- visual design system
- typography
- spacing system
- motion language
- layout composition details
- component styling

## Builder expectations

- Preserve the route-level feature set, even if the visual grouping changes.
- Consume the screen-shaped view contracts instead of re-deriving everything from raw workflow artifacts in component code.
- Keep non-happy states explicit: loading, empty, blocked, stale, disabled, and error.
- Keep clinical blockers and traceability failures more prominent than lower-risk UX polish.
- Do not add sign-in, account, profile, or tenant-admin UX in the current local-open phase.

## Minimum evidence the final UI must retain

- reviewers can find and act on clinical governance blockers
- reviewers can see claim trace coverage into panel, render, and lettering outputs
- reviewers can run evaluations and understand gate failures
- reviewers can inspect export history and retrieve release bundles
- the UI makes it obvious when a run is not yet exportable and why
