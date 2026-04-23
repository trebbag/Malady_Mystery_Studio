# Disease Comic Platform

Local-first platform for turning any typed disease or condition into a medically traceable comic production pipeline with research assembly, workbook, scene, panel, rendered-output, review, eval, and export artifacts.

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
  - `/runs/:runId/rendering-guide`
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

- Foundation and local runtime: `97%`
- Open disease intake and research assembly: `84%`
- Clinical truth layer and governance: `94%`
- Workbook and guardrails: `76%`
- Scene, panel, and rendered-output flow: `92%`
- Review, eval, and export workflow: `98%`
- Frontend structure and UX implementation: `95%`
- Managed platform and pilot ops: `64%`
- Optional external-art attachment and downstream publishing: `48%`

Overall:
- Local MVP readiness: `95%`
- Pilot readiness: `68%`

## What remains before MVP and pilot

- Broaden governed disease and source coverage through promoted packs, stronger source refresh ownership, and contradiction triage for newly typed diseases.
- Deepen reviewer collaboration with richer mention delivery, stronger thread UX, notification polish, and queue analytics.
- Finish the real managed runtime cutover from local SQLite/filesystem fallback to PostgreSQL plus Blob in the live execution path.
- Harden Azure deployment, secrets wiring, restore drills, and operational observability beyond the current scaffold.
- Integrate external auth and gateway identity when the product moves beyond local-open operator mode.
- Add optional downstream publishing/export integrations after the rendered-panel export path is stable.
