# ADR 0002: Use a durable workflow state machine with an event log

- **Status:** Accepted
- **Date:** 2026-04-21
- **Owners:** Architecture
- **Decision type:** architecture

## Context

The product creates many intermediate artifacts: disease packet, story workbook, scene cards, panel plans, prompts, QA reports, approvals, and export bundles. These steps must be inspectable, restartable, and auditable.

## Decision

Model the system as a durable workflow with explicit states, stage transitions, and append-only event logging. Every transition should create a typed event and update a typed workflow-run object.

The workflow stage order now accepts arbitrary disease input, compiles provisional clinical evidence when no governed pack exists yet, and treats `render-execution` as the default path to done. A compiled `rendering-guide` still exists, but as a secondary QA, retry, and manual handoff artifact rather than the definition of completion.

Before `render-execution` can begin, the workflow must pause after `render-prep` with `pauseReason = render-guide-review-required`. The latest `rendering-guide`, latest `visual-reference-pack`, and latest `render-guide-review-decision` must align and be approved before any stub, OpenAI, retry, manual attachment, or future reference-image rendering path can proceed.

## Consequences

### Positive
- clearer restart and retry semantics
- better auditability
- easier human-in-the-loop review
- better traceability for eval failures
- explicit rendered-output release gating before pilot release assembly
- explicit pre-render review gating before any panel generation
- open-disease research assembly can be inspected and replayed before the run advances into story and panel work
- prompt and rendering-guide artifacts remain auditable secondary support assets

### Tradeoffs
- more up-front engineering work than a simple queue chain
- requires discipline around idempotency and status transitions
- requires migration logic for older guide-first runs so they remain readable beside the current rendered-output flow

## Alternatives considered
- loosely coupled async jobs with implicit state in the database: rejected for low observability
- single synchronous request/response pipeline: rejected for poor scalability and review ergonomics
