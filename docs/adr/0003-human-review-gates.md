# ADR 0003: Make human review and release gates first-class workflow stages

- **Status:** Accepted
- **Date:** 2026-04-21
- **Owners:** Product, Clinical, Editorial
- **Decision type:** workflow

## Context

The platform produces medical educational content intended for broad use. Some generated artifacts may look polished even when they are medically weak, narratively unfair, or operationally noncompliant.

## Decision

Human review and release gates are explicit stages in the workflow, not optional manual side processes. The workflow engine must support reviewer assignment, approval recording, rejection reasons, and gated progression.

## Consequences

### Positive
- safer release posture
- better accountability
- clearer organizational operating model

### Tradeoffs
- review queues become an operational dependency
- turnaround time must be managed deliberately
