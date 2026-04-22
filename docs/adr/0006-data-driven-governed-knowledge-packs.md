# ADR 0006: Store governed disease knowledge as local data packs

- **Status:** Accepted
- **Date:** 2026-04-22
- **Owners:** Clinical lead + Platform lead
- **Decision type:** data

## Context

The starter clinical retrieval layer currently relies on hard-coded disease and source data embedded in service code. That makes it harder to:
- expand the approved disease set without code changes,
- review or diff medical content as data,
- persist reviewer governance decisions against authored source metadata,
- validate richer clinical artifacts such as fact tables and evidence graphs.

## Decision

Store governed disease knowledge in local authored data packs under a dedicated knowledge directory. Service code will load these packs, derive runtime clinical artifacts from them, and overlay persisted governance decisions and contradiction resolutions from the local platform store.

## Consequences

### Positive
- medical content becomes reviewable data instead of code constants
- new diseases can be added without editing service logic
- source governance can be overlaid durably at runtime
- contract validation can cover authored clinical content directly

### Tradeoffs
- knowledge-pack authoring becomes a first-class maintenance workflow
- loader and validation code must handle malformed or incomplete pack data
- local packs still need later migration paths to external governed source ingestion

## Alternatives considered
- keep disease knowledge hard-coded in service modules: rejected for weak governance ergonomics
- move immediately to external source ingestion: rejected for this local-first batch because it is too large a jump
