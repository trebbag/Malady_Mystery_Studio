# ADR 0009: Accept open disease intake through provisional knowledge packs

- **Status:** Superseded by ADR 0013
- **Date:** 2026-04-23
- **Owners:** Clinical systems lead + Product lead
- **Decision type:** product + architecture

## Context

The product can no longer depend on a fully pre-seeded disease library. Reviewers need to be able to type an unseen disease or condition and let the system assemble provisional, source-traceable clinical evidence. This ADR previously allowed a strong draft package to continue into workbook and panel generation before review, while still blocking export until a human reviewer approved or promoted the pack.

## Decision

Accept arbitrary disease input. Canonicalization supports a `new-disease` path for researchable but not yet governed inputs. For that path, the current system now creates a run-scoped provisional `medical-dossier`, `agent-run`, `agent-step`, `source-discovery-report`, `medical-dossier-build-report`, `medical-dossier-qa-report`, `disease-knowledge-pack`, `research-brief`, `source-harvest`, and `knowledge-pack-build-report`. The automatic continuation rule is superseded: story generation is blocked until the latest medical dossier is approved.

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
