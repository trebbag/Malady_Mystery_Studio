# Needs From You

The current repo still runs locally without any external credentials. The items below are only required to complete the managed Azure pilot path and any optional downstream integrations beyond the default rendering-guide export path.

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
  - whether optional rendered-output review should ever block guide-first export

## Clinical Governance and Ownership

- Confirmation of the initial primary owner and backup owner roles for source refresh work in the pilot.
- Confirmation of the first primary-care reviewer group responsible for:
  - source refresh
  - contradiction resolution
  - render-retry review when medical fidelity is at issue
- Confirmation of any additional primary-care diseases that must be added immediately after the current tranche.

## Identity and Access

- External operator identity is still out of scope for this tranche, but pilot planning still needs:
  - chosen IdP
  - issuer / audience / JWKS details
  - initial operator roster and pilot roles

## Release and Delivery

- Confirm whether pilot bundles should remain app-retrievable only or also mirror to an external delivery location.
- Confirm the first non-local delivery target after the managed pilot bundle path is cut over.
