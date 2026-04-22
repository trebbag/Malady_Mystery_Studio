# services/intake-api

Thin API entry point for project creation, workflow launch, and artifact retrieval.

Expected responsibilities:
- validate input
- authorize requests
- hand off to orchestrator
- return typed responses

Current starter capabilities:
- serve `/signin`, `/intake`, `/review`, and run-level review pages for starter reviewer workflows
- create and fetch projects using the `project` contract with tenant tagging
- persist projects, runs, artifacts, sessions, audit logs, and export history through SQLite-backed metadata plus object storage
- advance a run through intake, canonicalization, disease-packet creation, story-workbook generation, scene planning, panel planning, and render prep
- pause ambiguous canonicalization for human review, then resume the pipeline after clinical confirmation or override
- apply workflow events and approval decisions through typed API endpoints with tenant-aware role checks
- expose generated artifacts, evidence records, source governance records, workbook review traces, separated lettering assets, release bundles, and run-scoped audit logs for reviewer inspection
- create local-password and starter OIDC-backed server-side sessions and allow tenant-admin role management
- export approved runs into release bundles with bundle retrieval, human-readable bundle indexes, evidence packs, and export history
- validate responses against the shared schema registry before returning them
