# Disease Comic Platform

Local-first starter platform for turning a disease or condition into a medically traceable comic production package with workbook, scene, panel, render, review, eval, and export artifacts.

## Local runtime

- Open local mode only. There is no sign-in, account, profile, session, or tenant-admin product surface in this batch.
- Default actor: `local-operator`
- Default tenant: `tenant.local`
- Local metadata store: `var/db/platform.sqlite`
- Local object storage: `var/object-store`

## Core commands

```bash
pnpm install
pnpm dev:api
pnpm lint
pnpm typecheck
pnpm test
pnpm validate:pack
pnpm build
```

## Local workflow utilities

```bash
pnpm eval:run -- --run-id <runId>
pnpm local:backup
pnpm local:reset
pnpm local:restore -- --path var/backups/<timestamp>
```

## Local review flow

- Open [http://127.0.0.1:3000/review](http://127.0.0.1:3000/review) for the local review dashboard.
- Open [http://127.0.0.1:3000/intake](http://127.0.0.1:3000/intake) to create a project and start a workflow run.
- Use the run page to resolve canonicalization blockers, record approvals, run evals, and export bundles.

## Current local MVP status

- Foundation and local runtime: `95%`
- Clinical truth layer: `91%`
- Workbook and guardrails: `75%`
- Scene, panel, render-prep: `72%`
- Local review, eval, and export workflow: `90%`
- Frontend structure and UX prep: `70%`
- Operational pilot readiness: `38%`

Overall:
- Local MVP readiness: `85%`
- Pilot readiness: `45%`

## What remains before MVP and pilot

- Add reviewer comments, diffing, assignment, and queueing on top of the current debug-oriented review UI.
- Expand the governed disease and source library beyond the current twelve-disease local pack set.
- Deepen contradiction handling, source refresh, and source owner workflows beyond the current local controls.
- Add live render integration and retry orchestration instead of stopping at render-prompt generation.
- Move from local SQLite and filesystem object storage to managed infrastructure for a pilot.
- Add real deployment, observability, retention execution, backup policies, and recovery drills.
- Integrate real auth at an external frontend or gateway layer when the app moves beyond local-open mode.
