# Codex playbook

This document explains how to use Codex effectively on this project.

## Golden rule

Do not ask Codex to “build the whole platform” in one pass. Use the repo the way a disciplined engineering team would use it:
- vision in `docs/master-spec.md`
- durable rules in `AGENTS.md`
- architecture decisions in `docs/adr/`
- machine contracts in `contracts/`
- quality targets in `evals/`
- small implementation slices in `docs/backlog/tickets/`

## Recommended workflow

### 1. Ask mode: planning
Have Codex read:
- `AGENTS.md`
- `docs/master-spec.md`
- `docs/repo-map.md`
- `docs/backlog/milestone-plan.md`

Then ask for:
- system decomposition,
- dependency ordering,
- milestone sequencing,
- ADR gaps,
- first implementation slice.

### 2. Code mode: one ticket at a time
Pick a single ticket file from `docs/backlog/tickets/` and ask Codex to implement only that ticket. Require:
- contract updates,
- tests/evals,
- docs updates.

### 3. Review mode
After implementation, ask Codex to review the branch against:
- the ticket,
- the affected contracts,
- affected evals,
- release gates.

### 4. Human review
A human should review:
- medical implications,
- workflow changes,
- security/privacy changes,
- release gate weakening.

## Good prompt pattern

A good implementation prompt contains:
- a single ticket identifier,
- exact files or folders in scope,
- languages/frameworks,
- constraints,
- definition of done,
- test/eval expectations.

## Bad prompt pattern

A bad prompt sounds like:
“Build this entire company-level app from the spec.”

That usually causes:
- missing contracts,
- missing evals,
- weak boundaries,
- unreviewable diffs,
- accidental architecture drift.

## When to create a new ADR

Create or update an ADR when:
- a technology choice becomes durable,
- a breaking contract is introduced,
- release gates change,
- the workflow engine changes fundamentally,
- security or privacy posture changes,
- model/provider abstraction changes.

## When to add an eval

Add or update evals when:
- a prompt changes,
- an orchestration step changes,
- a grading rubric changes,
- a model changes,
- a story-quality failure is discovered,
- a medical hallucination or sequencing error is discovered.
