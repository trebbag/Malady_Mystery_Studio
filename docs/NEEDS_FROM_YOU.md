# Needs From You

The current repo still runs locally without any external credentials if you are comfortable using stub rendering. The items below are required to complete the real OpenAI rendered-panel path and the managed Azure pilot path.

## OpenAI Render and Research Runtime

- `OPENAI_API_KEY` for real disease research assembly and real panel rendering through the OpenAI APIs.
- Confirmation that your OpenAI org is verified for GPT Image usage if the image endpoint requires it.
- Optional model override if you want something other than the default `OPENAI_RENDER_MODEL=gpt-image-1.5`.
- The approved public-source policy for agent web research on unseen diseases:
  - allowed public domains beyond the current medical allowlist
  - whether user-supplied documents should outrank public web evidence by default
  - whether provisional packs may continue into story and rendering automatically when they pass draft gates

## Azure Pilot Foundations

- Azure subscription ID for the first internal pilot environment.
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

- `MANAGED_POSTGRES_URL`
- `AZURE_BLOB_CONNECTION_STRING`
- `AZURE_SERVICE_BUS_CONNECTION_STRING`
- Container image references for the API and worker when the Azure deployment tranche is actually cut over.

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

- Confirm whether pilot bundles should remain app-retrievable only or also mirror to an external delivery location.
- Confirm the first non-local delivery target after the managed pilot bundle path is cut over.
