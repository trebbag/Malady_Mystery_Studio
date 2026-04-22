# services/exporter

Builds governed release bundles and export packages from approved workflow runs.

Current responsibilities:
- assemble a release bundle only after workflow approval and release-gate checks pass
- enforce required approvals, artifact completeness, QA verdict, evidence-governance gates, and fresh passing eval status when the API requests a real export
- generate machine-readable bundle artifacts plus a human-readable release index
- generate a structured source-evidence pack for reviewer traceability and downstream audit
- support preview assembly for governance evals without persisting an export
- return export-history records that can be persisted by the API layer
