# intake-api source

Implemented starter modules:
- `app.mjs` for request routing, intake validation, auth-aware review flows, clinical generation, scene/panel/render planning, export assembly, and schema-backed responses
- `auth.mjs` for tenant-aware identities, local password login, starter OIDC exchange, secure server-side sessions, and role permissions
- `review-ui.mjs` for server-rendered sign-in, dashboard, intake, and run review pages
- `server.mjs` to run the HTTP service locally
- `store.mjs` for SQLite-backed metadata, object-backed artifacts/documents, migrations, retention defaults, and session persistence
- `object-storage.mjs` for atomic file-backed object persistence used by artifacts, release bundles, bundle indexes, and evidence packs
- `app.test.mjs` for end-to-end API smoke coverage
