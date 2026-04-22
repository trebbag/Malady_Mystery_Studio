# Evidence Traceability Rubric

This local deterministic family measures whether clinically meaningful downstream artifacts still point back to the governed disease packet.

## Core checks

- claim-linked artifacts retain valid `linkedClaimIds`
- suspended or stale sources do not masquerade as clean support
- blocking contradictions stop the score
- downstream panels, render prompts, and lettering maps preserve trace coverage

## Failure modes

- orphaned claim ids
- missing claim links on clinically meaningful downstream artifacts
- stale or suspended sources still counted as approved support
- unresolved blocking contradictions
