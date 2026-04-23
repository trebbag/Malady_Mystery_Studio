# Disease Comic Platform

Local-first platform for turning any typed disease or condition into a medically traceable comic production pipeline with research assembly, workbook, scene, panel, rendered-output, review, eval, and export artifacts.

## Local runtime

- Open local mode only. There is no sign-in, account, profile, session, or tenant-admin product surface in this batch.
- Default actor: `local-operator`
- Default tenant: `tenant.local`
- Local metadata store: `var/db/platform.sqlite`
- Local object storage: `var/object-store`
- Active persistence policy: files and large generated artifacts stay in the local filesystem object store. Postgres is not required and must not be used as a file/blob store.
- Local entrypoints load repo-root `.env` automatically. `.env` is gitignored and must never be committed.

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
```

Optional future portability checks are still available, but they are not required for the active local-storage app path:

```bash
pnpm migrate:managed -- --dry-run
pnpm ops:restore-smoke -- --dry-run
```

## No-key local behavior

- `RENDER_PROVIDER=stub-image` is the default. It creates deterministic rendered-asset manifests for every required panel, with prompt hashes, continuity locks, anatomy locks, lettering-separation status, retry strategy, and acceptance checks.
- Stub rendered assets are explicitly marked as non-final placeholders. They validate local workflow structure, release wiring, traceability, and gates only; they do not certify final image quality.
- Arbitrary typed diseases can compile locally without `OPENAI_API_KEY` through fixture-backed provisional research assembly. Those packs remain provisional and reviewer-gated until approved or promoted.
- Local backup, reset, and restore operate on `var/db/platform.sqlite` plus `var/object-store/**`.
- Managed migration and restore smoke commands are retained as optional dry-run portability checks only. Live Postgres/Azure cutover is deferred and not part of the local-storage product path.

## ClinicalEducation compatibility

This repo is a rebuild, but it keeps the old ClinicalEducation/Malady Mystery external integration surface where that surface is still safe and aligned with the current product path:

- `OPENAI_API_KEY` remains a backend-only secret for live research and `gpt-image-2` panel rendering.
- `KB_VECTOR_STORE_ID` reuses the old OpenAI vector-store knowledge base during live provisional disease research.
- `MMS_MODEL` is still honored as the research-model fallback after `OPENAI_RESEARCH_MODEL`.
- `MMS_CANON_ROOT`, `MMS_CHARACTER_BIBLE_PATH`, `MMS_SERIES_STYLE_BIBLE_PATH`, `MMS_DECK_SPEC_PATH`, and `MMS_EPISODE_MEMORY_PATH` are recognized for canon/story profile inputs.
- `MAX_CONCURRENT_RUNS`, `MMS_RUN_RETENTION_KEEP_LAST`, `MMS_PIPELINE_MODE`, fake-mode delay, v2 timeout, and agent-isolation environment variables are surfaced in `/settings` for continuity with the previous app.

The active render path remains OpenAI-targeted (`gpt-image-2`) or local `stub-image`. Deprecated non-OpenAI provider labels from older files are not part of the active rebuilt app.

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

- Foundation and local runtime: `99%`
- Local storage, backup, restore, and artifact retention: `97%`
- Open disease intake and research assembly: `90%`
- Clinical truth layer and governance: `96%`
- Workbook and guardrails: `79%`
- Scene, panel, and rendered-output flow: `96%` structurally, with real image quality still credential-blocked
- Review, eval, export, and queue operations: `99%`
- Frontend UX: `97%`
- Optional managed deployment: `20%` deferred, not required for local storage

Overall:
- Local MVP readiness: `98%`
- Local-storage pilot readiness: `76%`

## What remains before MVP and pilot

- Run a deliberate real ChatGPT Image 2.0 / `gpt-image-2` smoke with the configured local `.env` key; current stub images are structural placeholders only.
- Keep active persistence local and run backup/reset/restore/retention drills on realistic run volume.
- Broaden promoted governed source coverage and ownership workflows beyond fixture-backed provisional packs.
- Integrate external auth and gateway identity when the product moves beyond local-open operator mode.
- Add optional downstream publishing/export integrations after the rendered-panel export path is stable.
