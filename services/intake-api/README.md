# services/intake-api

Thin local API entry point for project creation, workflow launch, eval execution, review, and export.

Current local capabilities:
- serve `/intake`, `/review`, and run-level review pages in open local mode
- create and fetch projects using the `project` contract with `tenant.local`
- persist projects, runs, artifacts, audit logs, and export history through SQLite-backed metadata plus filesystem object storage
- advance a run through intake, canonicalization, disease-packet creation, story-workbook generation, scene planning, panel planning, and render prep
- pause ambiguous canonicalization for reviewer confirmation, then resume the pipeline
- run deterministic local evals and persist them as `eval-run` artifacts
- gate export on the latest fresh passing eval run
- export approved runs into local release bundles with bundle retrieval, human-readable bundle indexes, evidence packs, and export history
- validate responses against the shared schema registry before returning them

Intentionally not in scope for this batch:
- sign-in or sessions
- account or profile management
- tenant-admin UI or APIs
- hosted infrastructure or external auth
