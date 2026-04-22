# services/clinical-retrieval

Builds disease packets from approved source inputs.

Current starter responsibilities:
- ontology-backed canonicalization adapters
- governed evidence object creation
- disease packet assembly with freshness and contradiction rollups
- claim and source traceability support

Starter implementation notes:
- uses a seeded, non-PHI disease library for known MVP diseases, now expanded beyond the original HCC/MG/CAP/DKA slice
- returns explicit `resolved`, `ambiguous`, and `unresolved` canonicalization outcomes
- exposes evidence lookup by claim id and governed source records for reviewer inspection
