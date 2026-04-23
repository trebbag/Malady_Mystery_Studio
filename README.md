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
pnpm dev:worker
pnpm dev:web
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
pnpm migrate:managed
pnpm ops:restore-smoke
```

## Local review flow

- In active frontend development, run `pnpm dev:web` and open [http://127.0.0.1:5173/review](http://127.0.0.1:5173/review).
- In built mode, the intake API serves the SPA at [http://127.0.0.1:3000/review](http://127.0.0.1:3000/review).
- The primary SPA routes are:
  - `/review`
  - `/review/queue`
  - `/runs/:runId/pipeline`
  - `/runs/:runId/review`
  - `/runs/:runId/packets`
  - `/runs/:runId/evidence`
  - `/runs/:runId/workbooks`
  - `/runs/:runId/scenes`
  - `/runs/:runId/panels`
  - `/runs/:runId/sources`
  - `/runs/:runId/governance`
  - `/runs/:runId/evals`
  - `/runs/:runId/bundles`
  - `/settings`
- The server-rendered fallback/debug routes remain at:
  - `/debug/intake`
  - `/debug/review`
  - `/debug/review/runs/:runId`

## Current local MVP status

- Foundation and local runtime: `96%`
- Clinical truth layer: `93%`
- Workbook and guardrails: `76%`
- Scene, panel, render-prep: `79%`
- Local review, eval, export, and queue workflow: `97%`
- Frontend structure and UX implementation: `93%`
- Managed platform and pilot ops: `58%`
- Live render execution: `62%`

Overall:
- Local MVP readiness: `93%`
- Pilot readiness: `61%`

## What remains before MVP and pilot

- Finish the true managed runtime cutover from local SQLite/filesystem fallback to PostgreSQL plus Blob in the live execution path.
- Harden Azure deployment, secrets wiring, restore drills, and operational observability beyond the current scaffold.
- Add deeper multi-user reviewer collaboration features such as delivery-grade mentions, queue analytics, and richer escalation handling.
- Expand governed disease and source coverage beyond the current starter, expansion, and primary-care tranches.
- Harden render-output review, retry ergonomics, and downstream publishing beyond the current Gemini-first pilot path.
- Integrate external auth and gateway identity when the product moves beyond local-open operator mode.
