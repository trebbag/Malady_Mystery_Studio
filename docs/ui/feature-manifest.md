# UI Feature Manifest

This directory is a placeholder/prep layer for a future UI-focused builder. The goal is to make the intended screens, sections, actions, and state handling explicit without locking a visual system.

## Route Inventory

### `/intake`
- Purpose: capture the disease request and start a local workflow run.
- View contract: `contracts/disease-intake-request.schema.json`
- Required actions:
  - create project
  - start workflow
- Required states:
  - empty
  - loading
  - success
  - error

### `/review`
- Purpose: local review dashboard and run queue.
- View contract: `contracts/review-dashboard-view.schema.json`
- Required controls:
  - disease filter
  - workflow-state filter
  - current-stage filter
  - export-status filter
  - latest-eval-status filter
  - sort control
- Required dashboard stats:
  - blocked clinical runs
  - awaiting review
  - stale evals
  - export-ready runs
- Required states:
  - empty
  - loading
  - filtered
  - error

### `/review/runs/:runId`
- Purpose: full local review of one workflow run.
- View contract: `contracts/review-run-view.schema.json`
- Required sections:
  - run summary
  - stage timeline
  - disease packet summary
  - fact table
  - evidence graph
  - teaching points
  - visual anchors
  - source governance decisions
  - contradiction status
  - downstream trace coverage
  - story workbook
  - scene cards
  - panel plans
  - render prompts
  - lettering maps
  - QA reports
  - latest eval summary
  - approvals
  - export history
  - audit log
- Required actions:
  - resolve canonicalization
  - record approval or rejection
  - record source governance decision
  - record contradiction resolution
  - rebuild clinical package
  - run evaluations
  - export bundle
- Required states:
  - loading
  - blocked
  - review-ready
  - export-ready
  - error

### `/review/runs/:runId/clinical-package`
- Purpose: focused clinical review with governed evidence and contradiction resolution.
- View contract: `contracts/clinical-package-view.schema.json`
- Required sections:
  - disease packet summary
  - fact table
  - evidence graph
  - clinical teaching points
  - visual anchor catalog
  - source governance
  - contradiction status
  - trace coverage
- Required states:
  - loading
  - governance-blocked
  - review-required
  - ready
  - error

### `/review/runs/:runId/evaluations`
- Purpose: latest eval run, family scores, and gate status.
- View contract: `contracts/evaluation-summary-view.schema.json`
- Required states:
  - missing
  - running
  - passed
  - failed
  - stale

### `/review/runs/:runId/exports`
- Purpose: export history and release bundle retrieval.
- View contract: `contracts/export-history-view.schema.json`
- Required states:
  - empty
  - loading
  - ready
  - error

### `/review/releases/:releaseId`
- Purpose: release bundle detail.
- View contract: `contracts/release-bundle.schema.json`
- Required sections:
  - quality summary
  - gate checks
  - artifact manifest
  - approvals

### `/review/sources/:sourceId`
- Purpose: source governance detail page.
- View contract: `contracts/source-governance-view.schema.json`
- Required sections:
  - source record
  - governance decisions

## Must-Be-Obvious UI Signals

- clinical blockers that stop story generation
- stale eval status
- export gating reasons
- contradiction status and severity
- source freshness and suspension state
- approval completeness and missing roles
- downstream trace coverage score and blockers

## Required Non-Happy States

- loading skeletons
- empty states with specific action guidance
- blocked states with reason text
- disabled actions with explicit reasons
- stale-eval warnings
- error states that keep the workflow context visible
