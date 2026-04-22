# services/exporter

Builds governed release bundles and export packages from approved workflow runs.

Current responsibilities:
- assemble a release bundle only after workflow approval and release-gate checks pass
- enforce required approvals, artifact completeness, QA verdict, and evidence-governance gates
- generate machine-readable bundle artifacts plus a human-readable release index
- generate a structured source-evidence pack for reviewer traceability and downstream audit
- return export-history records that can be persisted by the API layer
