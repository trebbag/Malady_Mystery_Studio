# ADR 0010: Keep local storage as the active runtime persistence model

- **Status:** Accepted
- **Date:** 2026-04-23
- **Owners:** Platform lead + Product lead
- **Decision type:** product + architecture

## Context

The rebuilt app is intended to run locally for the current product path. It produces many generated artifacts, including disease packets, evidence packs, workbooks, panel plans, render prompts, rendered assets, release bundles, and audit-backed review records. The project previously scaffolded optional managed metadata and object-storage adapters, but the active app does not need a managed database to support the current workflow.

## Decision

Keep the active runtime on local persistence:

- SQLite metadata at `var/db/platform.sqlite`
- filesystem object storage at `var/object-store/**`
- local backups under `var/backups/**`

Postgres is not required for the active product path. If a managed database is reintroduced later, it may store metadata/index rows only. It must not store binary files, large generated artifacts, rendered panel images, release bundles, or evidence packs. Those file-like payloads must remain in an object store: the local filesystem for this product path, or a real object store only if a future managed deployment decision is accepted.

## Consequences

### Positive

- The app can be piloted locally without Postgres, Blob Storage, Service Bus, or managed credentials.
- Generated files remain inspectable, backup-friendly, and easy to reset/restore.
- The product avoids accidentally coupling local creative workflows to managed infrastructure.
- Optional managed migration scripts can remain as portability checks without becoming the default path.

### Tradeoffs

- Multi-user remote concurrency and managed recovery drills remain deferred.
- Operators must treat local backup/reset/restore discipline as part of pilot readiness.
- Any future managed deployment needs a new cutover decision and proof that files are stored in object storage, not in Postgres.

## Alternatives considered

- Store generated files in Postgres: rejected because generated artifacts and rendered panels are file/blob payloads and should not live in relational tables.
- Make Azure Blob Storage the default object store: rejected for the current path because the user wants local storage and no managed credentials.
- Remove all managed scaffolding immediately: rejected because dry-run portability checks are useful, as long as they remain clearly optional and inactive.

