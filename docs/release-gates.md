# Release gates

A release candidate may move forward only if all required gates pass.

## Gate 1 — Contract integrity
- schemas validate
- examples validate
- backward-compatibility impact is documented
- breaking changes have ADR coverage

## Gate 2 — Medical accuracy
- required disease facts present
- forbidden inaccuracies absent
- treatment and diagnostic logic pass review
- evidence traceability present for material claims

## Gate 3 — Mystery and pedagogy
- diagnosis not revealed too early
- clue ladder complete
- final synthesis explains the disease fairly
- opener and closer loop is intact

## Gate 4 — Panelization and render readiness
- each panel has a purpose
- art/text separation preserved
- continuity anchors present
- no obvious flipbook redundancy

## Gate 5 — Security and privacy
- data-classification rules respected
- access-control assumptions documented
- audit log coverage preserved

## Gate 6 — Human approvals
Minimum recommended approvals:
- clinical reviewer
- editorial/narrative reviewer
- product/production reviewer

## Hard stops

Any of the following blocks release:
- untraceable material medical claims
- missing or failed eval thresholds
- missing human approval on publishable content
- hidden prompt changes with no review
- broken artifact contracts
