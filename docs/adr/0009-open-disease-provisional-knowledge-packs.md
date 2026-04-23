# ADR 0009: Accept open disease intake through provisional knowledge packs

- **Status:** Accepted
- **Date:** 2026-04-23
- **Owners:** Clinical systems lead + Product lead
- **Decision type:** product + architecture

## Context

The product can no longer depend on a fully pre-seeded disease library. Reviewers need to be able to type an unseen disease or condition, let the system assemble a provisional clinical package from governed and approved public sources, continue into workbook and panel generation when the draft package is strong enough, and still block export until a human reviewer approves or promotes that pack.

## Decision

Accept arbitrary disease input. Canonicalization now supports a `new-disease` path for researchable but not yet governed inputs. For that path, the system creates a run-scoped provisional `disease-knowledge-pack`, plus `research-brief`, `source-harvest`, and `knowledge-pack-build-report` artifacts. If the provisional package passes draft clinical gates, the run may continue automatically into workbook, panel, and rendered-output stages, but export remains blocked until a reviewer approves the pack for the run or promotes it into the shared library.

## Consequences

### Positive
- the system no longer depends on pre-seeded disease coverage for useful output
- every new disease still flows through typed evidence, provenance, and review artifacts
- promoted provisional packs create an organic path to broaden governed disease coverage over time

### Tradeoffs
- unseen-disease runs add more review pressure because provisional packs must be approved or promoted
- source freshness and contradiction handling become more important because agent-harvested evidence enters the system
- the distinction between run-scoped approval and global promotion must stay clear in the UI and audit log

## Alternatives considered

- require all diseases to be pre-seeded before a run can start: rejected because it blocks the core product value
- allow unseen diseases to bypass clinical governance and go straight to story output: rejected because it weakens medical traceability and release safety
