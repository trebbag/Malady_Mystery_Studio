# infra

Infrastructure notes and deployment scaffolding for the internal pilot path.

Current contents:
- `migrations/`
  - local and managed metadata-store SQL migrations
- `terraform/`
  - Azure pilot infrastructure scaffold for:
    - Container Apps
    - PostgreSQL Flexible Server
    - Blob Storage
    - Service Bus
    - Key Vault
    - Log Analytics / Application Insights

Current state:
- Terraform is scaffolded, not production-hardened.
- The live application path still defaults to local SQLite plus filesystem object storage.
- Managed migration and restore-smoke helpers now exist under `scripts/`, but they still need real environment values from `docs/NEEDS_FROM_YOU.md`.
