# ADR 0002: Use a durable workflow state machine with an event log

- **Status:** Accepted
- **Date:** 2026-04-21
- **Owners:** Architecture
- **Decision type:** architecture

## Context

The product creates many intermediate artifacts: disease packet, story workbook, scene cards, panel plans, prompts, QA reports, approvals, and export bundles. These steps must be inspectable, restartable, and auditable.

## Decision

Model the system as a durable workflow with explicit states, stage transitions, and append-only event logging. Every transition should create a typed event and update a typed workflow-run object.

## Consequences

### Positive
- clearer restart and retry semantics
- better auditability
- easier human-in-the-loop review
- better traceability for eval failures

### Tradeoffs
- more up-front engineering work than a simple queue chain
- requires discipline around idempotency and status transitions

## Alternatives considered
- loosely coupled async jobs with implicit state in the database: rejected for low observability
- single synchronous request/response pipeline: rejected for poor scalability and review ergonomics
