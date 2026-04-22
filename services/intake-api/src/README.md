# intake-api source

Implemented local modules:
- `app.mjs` for request routing, intake validation, workflow execution, local review flows, eval execution, export assembly, and schema-backed responses
- `auth.mjs` for the default open-local actor and tenant normalization helpers
- `eval-service.mjs` for deterministic local eval loading, scoring, and stale-eval detection
- `review-ui.mjs` for the server-rendered intake, dashboard, and run review pages
- `server.mjs` to run the HTTP service locally
- `store.mjs` for SQLite-backed metadata, object-backed artifacts/documents, migrations, and retention defaults
- `object-storage.mjs` for atomic file-backed object persistence used by artifacts, release bundles, bundle indexes, and evidence packs
- `app.test.mjs` for end-to-end local workflow coverage
- `eval-service.test.mjs` for dataset loading, applicability, and stale-eval coverage
