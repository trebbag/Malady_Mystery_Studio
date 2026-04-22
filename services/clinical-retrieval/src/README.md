# clinical-retrieval source

Implemented starter modules:
- `disease-library.mjs` seeded disease knowledge base
- `ontology-adapter.mjs` starter ontology lookup boundary for alias and canonical-disease resolution
- `source-registry.mjs` governed source record generation, freshness scoring, and contradiction metadata
- `service.mjs` canonicalization, evidence registry, source governance, and disease-packet assembly
- `service.test.mjs` coverage for known, ambiguous, and unresolved clinical intake behavior
