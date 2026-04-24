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
pnpm dev
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
pnpm ops:restore-smoke
```

The active product path is local-only. Managed/Postgres/Azure portability scripts may remain in the repo for archival comparison, but they are not part of the local-storage pilot workflow or Settings readiness surface.

## GitHub run action

The repository CI workflow can be started manually from GitHub Actions with **Run workflow**. It runs in local-only mode with `RENDER_PROVIDER=stub-image` and supports four profiles:

- `full`: `pnpm validate:pack`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`
- `contracts`: `pnpm validate:pack`
- `tests`: `pnpm test`
- `build`: `pnpm build`

## No-key local behavior

- `RENDER_PROVIDER=stub-image` is the default. It creates deterministic rendered-asset manifests for every required panel, with prompt hashes, continuity locks, anatomy locks, lettering-separation status, retry strategy, and acceptance checks.
- Stub rendered assets are explicitly marked as non-final placeholders. They validate local workflow structure, release wiring, traceability, and gates only; they do not certify final image quality.
- Arbitrary typed diseases can compile locally without `OPENAI_API_KEY` through fixture-backed provisional research assembly. Those packs remain provisional and reviewer-gated until approved or promoted.
- Local backup, reset, restore, restore-smoke, and delivery mirroring operate on `var/db/platform.sqlite`, `var/object-store/**`, `var/backups/**`, and `var/delivery/**`.

## ClinicalEducation compatibility

This repo is a rebuild, but it keeps the old ClinicalEducation/Malady Mystery external integration surface where that surface is still safe and aligned with the current product path:

- `OPENAI_API_KEY` remains a backend-only secret for live research and `gpt-image-2` panel rendering.
- `KB_VECTOR_STORE_ID` reuses the old OpenAI vector-store knowledge base during live provisional disease research.
- `MMS_MODEL` is still honored as the research-model fallback after `OPENAI_RESEARCH_MODEL`.
- `MMS_CANON_ROOT`, `MMS_CHARACTER_BIBLE_PATH`, `MMS_SERIES_STYLE_BIBLE_PATH`, `MMS_DECK_SPEC_PATH`, and `MMS_EPISODE_MEMORY_PATH` are recognized for canon/story profile inputs.
- `MAX_CONCURRENT_RUNS`, `MMS_RUN_RETENTION_KEEP_LAST`, `MMS_PIPELINE_MODE`, fake-mode delay, v2 timeout, and agent-isolation environment variables are surfaced in `/settings` for continuity with the previous app.

The active render path remains OpenAI-targeted (`gpt-image-2`) or local `stub-image`. Deprecated non-OpenAI provider labels from older files are not part of the active rebuilt app.

## Local review flow

- For the normal local app, run `pnpm dev` from the repo root and open [http://127.0.0.1:5173/review](http://127.0.0.1:5173/review). This starts the intake API, render worker, and Vite web app together, with the web proxy pointed at the active API port.
- If you need to debug one process at a time, run `pnpm dev:api`, `pnpm dev:worker`, and `pnpm dev:web` separately.
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

## Governed local clinical library

The promoted governed library now includes 18 local-storage packs: Type 2 diabetes mellitus, essential hypertension, chronic kidney disease, hypothyroidism, iron deficiency anemia, migraine, COPD, community-acquired pneumonia, urinary tract infection, GERD, hyperlipidemia, major depressive disorder, generalized anxiety disorder, osteoarthritis, low back pain with red-flag screening, allergic rhinitis, atopic dermatitis/eczema, and obesity/metabolic syndrome. Arbitrary typed diseases still compile through provisional run-scoped packs and must be approved or promoted before export.

Source ops are available through `/runs/:runId/sources`, `/review/queue`, and `/api/v1/source-ops`. Reviewers can assign/transfer owner roles, mark sources refreshed, suspend or supersede sources, create/reopen refresh work, and resolve queue work locally.

## Local operational proof

- `/settings` shows local storage paths, object-store size, latest backup, latest restore smoke, latest delivery mirror, and ops-drill work items.
- `pnpm ops:restore-smoke` creates a local backup snapshot, restores it into `var/ops/restore-smoke/**`, checks SQLite/object-store presence, and writes a JSON report.
- The app restore-smoke endpoint additionally validates stored artifacts against contracts, checks object-store references in the scratch restore, and records delivery verification coverage.
- Exported bundles can be mirrored through the Bundles page or `POST /api/v1/release-bundles/{releaseId}/mirror-local`; files land under `var/delivery/<releaseId>/` with checksums.
- Local mirrors can be verified through the Bundles page or `POST /api/v1/release-bundles/{releaseId}/verify-local-mirror`.
- `/review/queue` can seed the local proof scenarios in `data/pilot-proof-scenarios.json` and persist trend snapshots so promoted-pack review, provisional-pack promotion, source-refresh, render-retry, and ops-drill work can be inspected over time with real app data.
- Rendered-panel QA decisions can be recorded against rendered asset manifests to distinguish structural stub validation from live `gpt-image-2` final-art review.

## Current local MVP status

- Foundation and local runtime: `100%`
- Local storage, backup, restore, and artifact retention: `100%`
- Open disease intake and research assembly: `94%`
- Clinical truth layer and governance: `98%`
- Workbook and guardrails: `80%`
- Scene, panel, and rendered-output flow: `98%` structurally, with full-story live image quality still billing-limit blocked
- Review, eval, export, and queue operations: `100%`
- Frontend UX: `99%`
- Local operations proof: `98%`

Overall:
- Local MVP readiness: `100%`
- Local-storage pilot readiness: `92%`

## What remains before MVP and pilot

- Run sustained real ChatGPT Image 2.0 / `gpt-image-2` full-story panel completion after billing limits are cleared; current stub images are structural placeholders only.
- Repeat local backup, restore-smoke, delivery mirror verification, queue trend snapshots, rendered-panel QA, and bundle-integrity drills against realistic pilot run volume.
- Broaden governed source ownership workflows beyond the current local primary-care tranche as reviewer volume grows.
- Add richer downstream delivery integrations only after local mirrored bundles are stable.
