# Needs From You

Nothing new is required from you to run the current local-only slice. The app now runs in open local mode with SQLite plus filesystem object storage.

The following decisions still remain for a real pilot beyond this local batch:

## Identity and Access

- Choose the production IdP and provide issuer, audience, and JWKS or shared-secret details for the first real tenant.
- Confirm whether the first pilot needs SSO only, local fallback accounts, or both.
- Confirm the initial tenant roster and who should hold `Owner`, `Clinical Reviewer`, `Editorial Reviewer`, `Product Editor`, `Auditor`, and `Viewer` roles.

## Persistence and Storage

- Choose the first persistent deployment target for relational metadata.
  Current code uses SQLite locally; pilot should move to a managed relational store.
- Choose the first object storage target for artifacts, release bundles, bundle indexes, and evidence packs.
- Confirm retention windows if they should differ from the current starter defaults for `approved-artifact`, `release-bundle`, `audit-log`, and `session`.

## Clinical Governance

- Confirm the next approved disease set to add beyond the current seeded library.
- Confirm which source owners or reviewers are responsible for approving source records and contradiction resolutions.
- Confirm whether any pilot diseases require additional ontology mappings beyond the current ICD-10 starter identifiers.

## Release and Operations

- Confirm the first pilot export targets beyond JSON and the human-readable bundle index.
- Confirm whether pilot release bundles must be retrievable only through the app or also mirrored to an external delivery location.
- Confirm the deployment environment, observability stack, and backup expectations for the pilot.
