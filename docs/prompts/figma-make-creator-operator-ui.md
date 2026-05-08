# Figma Make Prompt: Creator-Operator Local Comic Production App

Use this prompt to create a new Figma Make file for the local Malady Mystery Studio frontend. Design the product workflow and information architecture only. Do not invent backend concepts, account features, cloud deployment features, or authentication screens.

## Product Context

Design a local-only web app that helps one creator-operator turn a typed disease or condition into a clinically reviewed, detective-story comic with rendered panels. The app runs locally, stores metadata in SQLite, stores generated files in the local filesystem, and uses the default local actor `local-operator`. There is no sign-in, account/profile menu, tenant administration, cloud storage, Slack/email delivery, or managed database setup in the active product.

The app already has backend APIs for workflow runs, clinical packages, rendering-guide review, visual-reference packs, render jobs, deterministic evals, release bundles, source operations, queue work items, notifications, local delivery mirrors, backup, and restore-smoke proof. The frontend should make those capabilities understandable to a non-technical creator-operator. Present backend evals as “safety checks” and rendered manifests as a “completed panel set” in the default UI, with the raw technical names available only in advanced/developer details.

## Primary User Goal

The user needs to know:

1. What disease story am I making?
2. What step is this run on?
3. What needs review before I can continue?
4. What is the one next action I should take?
5. Why is render or export blocked?
6. Where can I find the advanced clinical/source/render details if needed?

## Primary Navigation

Design a calm primary shell with only these main destinations:

- `Home`: start a disease run, explain what happens after starting, continue the most important run, and see plain-language blockers.
- `Runs`: a focused list of all local runs with friendly status, next action, active step, and blocker summary.
- `Queue`: cross-run review/source/render/ops work items, due dates, escalations, notifications, and thread counts.
- `Sources`: source-owner refresh operations across the local governed/provisional library.
- `Settings`: local-only runtime status, storage paths, backup/restore-smoke/delivery proof, and OpenAI render configuration status.

Do not show a 12-tab internal run navigation as the default user experience.

## Guided Run Workspace

For a selected run, design a guided workspace with these sections:

- `Run Overview`: one-line status, progress, active step, next action, blockers, and advanced-detail links.
- `Clinical Review`: disease packet summary, evidence/source issues, provisional-pack state, trace coverage, source freshness, and approval actions.
- `Story and Panel Plan`: story craft readiness, panel adaptation readiness, scene/panel count, and continuity warnings. This can be a summary-first page with advanced detail links.
- `Guide Review`: rendering guide, visual-reference pack, Cyto/Pip consistency locks, recurring references, panel readiness checklist, review history, and approve/request changes controls.
- `Render Panels`: render job state, provider/model, panel completion, retry/QA state, disabled reason, and queue rendering action.
- `Export`: safety-check state, release package readiness, completed panel-set status, local delivery mirror, checksums, backup/restore-smoke proof, and export/mirror actions.
- `Advanced Details`: links to the existing technical pages: pipeline, review console, packets, evidence, workbooks, scenes, panels, rendering guide, sources, governance, evals, and bundles.

Each section should show one primary action at a time. Secondary actions should be visually subordinate. Raw JSON or developer artifacts should be collapsed by default behind “Developer details.”

## Data The UI Must Display

Use these backend data concepts. Do not rename them into unsupported features.

- `review-dashboard-view.runs[]`: `runId`, `projectTitle`, `diseaseName`, `friendlyStatus`, `activeStep`, `nextAction`, `primaryBlocker`, `state`, `currentStage`, `latestEvalStatus`, `exportCount`, `activeWorkItemCount`, `overdueWorkItemCount`, `threadCount`, and `updatedAt`.
- `review-run-view.creatorWorkflow`: `friendlyStatus`, `activeStep`, `primaryAction`, `blockers`, `steps`, and `advancedLinks`.
- `clinicalPackage`: disease packet summary, evidence graph, source governance, contradiction status, trace coverage, and provisional/governed pack state.
- `renderingGuideView`: guide/references gate status, visual-reference pack, Cyto/Pip locks, panel matrix, guide warnings, review decision, render disabled reason, and panel prompts.
- `renderJobs`: queued/running/completed/failed/retry-required status, provider/model, panel counts, and manifest ID. In user-facing copy, call the manifest a completed panel set.
- `evaluationSummary`: latest eval status, family statuses, thresholds, and blocking issues. In user-facing copy, call these safety checks.
- `exportHistory`: release IDs, bundle status, exported dates, local bundle paths, and delivery mirror status.
- `workItems`, `reviewThreads`, and `notifications`: due dates, priority, unread state, thread counts, latest message preview, and linked work context.
- `localRuntimeView` and `localOpsStatus`: actor, tenant, SQLite path, object-store path, backup path, restore-smoke result, delivery mirror status, and readiness snapshot.

## Required States

Every page must have clear loading, empty, error, blocked, stale, disabled-with-reason, and success states.

The start-run form must also have a clear creating state and a human-readable failure state. The user should never wonder whether the app accepted the disease name.

Make these states prominent:

- Clinical package needs review.
- Provisional disease pack needs approval or promotion.
- Source is stale, suspended, contradicted, superseded, or ownerless.
- Rendering guide/reference pack is not approved or stale.
- Render panels are missing, failed, or require retry.
- Safety checks are missing, failed, or stale.
- Export is blocked by missing rendered panels, missing approval, stale source, failed safety checks, or local integrity issue.
- Local backup, delivery mirror, or restore-smoke proof has not been run.

## Content Rules

- Use plain language before technical terms.
- Keep medical safety gates visible but understandable.
- Do not show sign-in, profile, account switcher, organization switcher, tenant admin, cloud deployment setup, or external delivery integrations.
- Do not imply the app diagnoses patients.
- Keep lettering/text placement separate from image rendering.
- Make Cyto/Pip visual consistency and personality consistency easy to review before rendering.
- Keep `gpt-image-2` as the only live render target label; `stub-image` may appear only as a local structural placeholder provider.

## Deliverable

Create a cohesive app design for desktop first with responsive mobile behavior. The design should be calm, creator-friendly, and task-oriented. It should reduce the perceived complexity of the pipeline without hiding the required safety gates or advanced details.
