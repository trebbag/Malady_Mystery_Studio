# Needs From You

The current repo runs locally without external credentials by using fixture-backed provisional research assembly, SQLite metadata, filesystem object storage, in-process queueing, and the local `stub-image` renderer. Active persistence should stay local: `var/db/platform.sqlite` for metadata and `var/object-store/**` for generated files, rendered panels, release bundles, evidence packs, and attachments. Postgres is not required for the active product path and should not be used as a file/blob store.

The items below are required only for live OpenAI rendering/research or optional future infrastructure work.

## OpenAI Render and Research Runtime

- `OPENAI_API_KEY` and `KB_VECTOR_STORE_ID` may live in the repo-root `.env`; local Node entrypoints load that file automatically and never print the secret value.
- Confirmation that your OpenAI org is verified for GPT Image usage if the image endpoint requires it.
- Optional model override if you want something other than the default `OPENAI_RENDER_MODEL=gpt-image-2`.
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
- Confirm whether pilot bundles should remain app-retrievable only or also mirror to another local folder.

## Deferred Optional Azure Foundations

- Azure subscription ID, only if the app later moves away from local storage.
- Azure tenant ID used for Key Vault and managed infrastructure access.
- Preferred Azure region and resource-group naming convention for:
  - Container Apps environment
  - PostgreSQL Flexible Server
  - Blob Storage account/container
  - Service Bus namespace
  - Key Vault
  - Log Analytics / Application Insights
- Confirmation of the first backup and restore policy:
  - PostgreSQL retention window
  - Blob soft-delete retention window
  - restore-smoke cadence and scratch-environment expectations

## Managed Runtime Secrets

These are not needed for local storage. Keep them unset unless you intentionally re-open the optional managed deployment path.

- `MANAGED_POSTGRES_URL`
- `AZURE_BLOB_CONNECTION_STRING`
- `AZURE_SERVICE_BUS_CONNECTION_STRING`
- Container image references for the API and worker when the Azure deployment tranche is actually cut over.

Local dry-run commands are available before those credentials exist:

```bash
pnpm migrate:managed -- --dry-run
pnpm ops:restore-smoke -- --dry-run
```

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

- External operator identity is still out of scope for this tranche, but pilot planning still needs:
  - chosen IdP
  - issuer / audience / JWKS details
  - initial operator roster and pilot roles

## Release and Delivery

- Confirm whether pilot bundles should remain app-retrievable only or also mirror to an external delivery location later.
- Confirm the first non-local delivery target after the managed pilot bundle path is cut over.
