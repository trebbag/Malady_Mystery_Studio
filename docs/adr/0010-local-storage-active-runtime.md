# ADR 0010: Keep local storage as the only active runtime persistence model

- **Status:** Accepted
- **Date:** 2026-04-23
- **Owners:** Platform lead + Product lead
- **Decision type:** product + architecture

## Context

The rebuilt app is intended to run locally for the current product path. It produces many generated artifacts, including disease packets, evidence packs, workbooks, panel plans, render prompts, rendered assets, release bundles, and audit-backed review records. The project previously scaffolded optional managed metadata and object-storage adapters, but the active app does not need and should not present a managed database path for this phase.

## Decision

Keep the active runtime on local persistence:

- SQLite metadata at `var/db/platform.sqlite`
- filesystem object storage at `var/object-store/**`
- local backups under `var/backups/**`
- local delivery mirrors under `var/delivery/**`
- local restore-smoke scratch/results under `var/ops/restore-smoke/**`

Postgres, Blob Storage, Service Bus, managed secrets, external auth, email, Slack, and IdP integrations are not required for the active product path. Runtime factories must keep the app on SQLite, filesystem object storage, and in-process queues even when managed-looking environment variables are present. If managed deployment is reintroduced later, it requires a new cutover decision and separate acceptance proof.

## Consequences

### Positive

- The app can be piloted locally without Postgres, Blob Storage, Service Bus, or managed credentials.
- Generated files remain inspectable, backup-friendly, and easy to reset/restore.
- The product avoids accidentally coupling local creative workflows to managed infrastructure.
- Settings/readiness surfaces stay focused on local backup, restore-smoke, delivery mirror, queue analytics, and source governance proof.

### Tradeoffs

- Multi-user remote concurrency remains deferred.
- Operators must treat local backup/reset/restore discipline as part of pilot readiness.
- Any future managed deployment needs a new cutover decision and must not be implied by current Settings/readiness cards.

## Alternatives considered

- Store generated files in Postgres: rejected because generated artifacts and rendered panels are file/blob payloads and should not live in relational tables.
- Make Azure Blob Storage the default object store: rejected for the current path because the user wants local storage and no managed credentials.
- Keep managed scaffolding in the active UI/readiness path: rejected because the user has explicitly chosen local-storage-only and local-open-only for this phase.
