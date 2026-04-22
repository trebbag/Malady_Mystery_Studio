# services/orchestrator

Owns the durable workflow lifecycle.

Expected responsibilities:
- create workflow runs
- enforce state transitions
- dispatch stage work
- collect artifacts
- record events
- integrate approvals and release gates

This service should not own domain-specific generation logic.

Current starter capabilities:
- machine-readable workflow spec with explicit stage order and approval gates
- event application helpers for valid and invalid transition handling
- in-memory workflow event records suitable for API smoke tests
