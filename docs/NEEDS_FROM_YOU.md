# Needs From You

The current repo runs locally without external credentials by using fixture-backed provisional research assembly, SQLite metadata, filesystem object storage, in-process queueing, and the local `stub-image` renderer. Active persistence should stay local: `var/db/platform.sqlite` for metadata and `var/object-store/**` for generated files, rendered panels, release bundles, evidence packs, and attachments. Postgres is not required for the active product path and should not be used as a file/blob store.

The items below are required only for live OpenAI rendering/research or local pilot operating decisions. Managed databases, Blob Storage, Service Bus, external auth, email, Slack, IdP, and managed secrets are not required for this product phase.

## OpenAI Render and Research Runtime

- `OPENAI_API_KEY` and `KB_VECTOR_STORE_ID` may live in the repo-root `.env`; local Node entrypoints load that file automatically and never print the secret value.
- Confirmation that your OpenAI org/project stays verified and enabled for GPT Image usage. A local Celiac disease render smoke on 2026-04-24 loaded the configured key and successfully produced both low-quality and high-quality `gpt-image-2` images, so model access is no longer the active blocker. The remaining render validation work is full multi-panel app execution, approval, eval, and export using live images rather than stub placeholders.
- Raise or clear the OpenAI project billing hard limit before the full live panel set can finish. The app-path full Celiac render on 2026-04-24 stored real `gpt-image-2` panel assets, then OpenAI returned `billing_hard_limit_reached`, so remaining panels are externally billing-blocked.
- Optional model override if you want something other than the default `OPENAI_RENDER_MODEL=gpt-image-2`.
- Optional render quality override if you want to trade speed for finality. The default remains `OPENAI_RENDER_QUALITY=high`; set `OPENAI_RENDER_QUALITY=medium` or `low` only for faster drafts.
- Optional render timeout override via `OPENAI_RENDER_TIMEOUT_MS`; the default is 300000ms so high-quality panels can finish while still failing cleanly if a request hangs.
- Optional research-model override if you want something other than `OPENAI_RESEARCH_MODEL` / legacy `MMS_MODEL`.
- Optional canon-file path overrides if the legacy ClinicalEducation character/style/deck files should be used from a location outside this repo.
- Confirmation that stub rendered assets should remain non-final placeholders in any pilot bundle until replaced by live `gpt-image-2` outputs.
- The approved public-source policy for agent web research on unseen diseases:
  - allowed public domains beyond the current medical allowlist
  - whether user-supplied documents should outrank public web evidence by default
  - whether provisional packs may continue into story and rendering automatically when they pass draft gates

## Local Storage Pilot Confirmation

- Confirm whether the local backup directory should remain `var/backups` or move to another local path.
- Confirm any retention limits for local rendered panels and release bundles before pilot use.
- Confirm whether local delivery mirrors should remain under `var/delivery/<releaseId>/` or use another local filesystem path.
- Confirm how often pilot operators should run `pnpm ops:restore-smoke` during rehearsal and pilot use.
- Confirm how often pilot operators should capture queue trend snapshots, verify local delivery mirrors, and record rendered-panel QA decisions during rehearsal.

## Deferred Infrastructure

No Azure/Postgres cutover inputs are needed while this app remains local-open and local-storage only. Leave managed runtime secrets unset unless a later phase explicitly reopens cloud portability.

## Optional External Art Attachments

- Confirmation of whether externally rendered art should stay reference-only or also support mirrored binary ingestion later.
- Confirmation of the first downstream manual-attachment review policy:
  - who can approve externally attached rendered-output quality
  - whether optional externally attached rendered-output review should ever block export when the in-app rendered panels already pass

## Clinical Governance and Ownership

- Confirmation of the initial primary owner and backup owner roles for source refresh work in the pilot.
- Confirmation of the first primary-care reviewer group responsible for:
  - source refresh
  - contradiction resolution
  - render-retry review when medical fidelity is at issue
- Confirmation of who can:
  - approve provisional run-scoped disease packs for a single run
  - promote a provisional pack into the shared governed library
- Confirmation of any additional diseases that must be prioritized immediately after the current tranche.

## Identity and Access

- External operator identity is out of scope for this local-open tranche. No IdP, issuer, audience, JWKS, session, account, profile, or tenant-admin input is required.

## Release and Delivery

- Confirm whether local mirrored bundles should be the only pilot handoff path or whether another local-only delivery folder should be added later.
