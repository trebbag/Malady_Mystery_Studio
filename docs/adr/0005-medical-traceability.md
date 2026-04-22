# ADR 0005: Require claim-level medical traceability in the disease packet

- **Status:** Accepted
- **Date:** 2026-04-21
- **Owners:** Clinical lead + Platform lead
- **Decision type:** data

## Context

Narrative artifacts will transform clinical facts into stories and visuals. Without claim-level traceability, reviewers cannot reliably verify whether a panel or reveal sequence is medically supported.

## Decision

Every material medical claim in the disease packet shall carry a claim identifier and evidence metadata. Downstream artifacts should reference claim identifiers where feasible.

## Consequences

### Positive
- enables reviewer tooling
- supports audits and updates
- reduces silent fact drift

### Tradeoffs
- richer data model
- more work in retrieval and authoring
