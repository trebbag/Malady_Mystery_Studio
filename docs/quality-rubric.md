# Quality rubric

This rubric is intended for both human review and automated/LLM-assisted grading.

## 1. Medical accuracy (weight: highest)
Questions:
- Are signs, symptoms, diagnostics, pathophysiology, and treatment accurate?
- Are the visuals and metaphors faithful to the disease process?
- Are statements appropriately scoped and non-overgeneralized?
- Is source traceability present for material claims?

Suggested score bands:
- 5 — provider-grade, internally consistent, traceable, nuanced
- 4 — accurate with minor omissions
- 3 — mostly correct but important details simplified or weakly sourced
- 2 — notable inaccuracies or unsafe oversimplifications
- 1 — clinically unreliable

## 2. Mystery integrity
Questions:
- Is the diagnosis withheld until it is narratively earned?
- Are clues planted fairly?
- Are red herrings plausible but honest?
- Does the reveal explain why the evidence fits?

## 3. Educational sequencing
Questions:
- Does discovery precede jargon when appropriate?
- Does the audience learn physiology alongside pathology?
- Does the final recap unify symptoms, testing, and treatment logic?

## 4. Story quality
Questions:
- Is the story funny, energetic, whimsical, and coherent?
- Do the detectives have a distinct dynamic?
- Is there escalation, reversal, and satisfying payoff?
- Does the opening side plot close cleanly?

## 5. Panelization quality
Questions:
- Does each panel have a clear purpose?
- Are transitions readable?
- Are scale changes legible?
- Is repetition controlled?

## 6. Render-readiness
Questions:
- Is each prompt visually specific?
- Are continuity anchors present?
- Is text separated from art instructions?
- Are anatomy and staging clear enough for an image model?

## 7. Governance quality
Questions:
- Can reviewers see where facts came from?
- Are approvals explicit?
- Is the release decision auditable?

## Minimum release thresholds

Recommended initial thresholds:
- medical accuracy: 0.97+
- mystery integrity: 0.88+
- educational sequencing: 0.90+
- panelization: 0.90+
- render-readiness: 0.92+
- governance/security: pass/fail; must pass
