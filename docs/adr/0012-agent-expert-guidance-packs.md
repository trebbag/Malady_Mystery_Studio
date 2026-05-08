# ADR 0012: Distill Expert Story, Panel, and Image Guidance Into Versioned Agent Packs

## Status

Accepted

## Context

The local product now depends on specialist craft guidance for detective-story construction, comic panel adaptation, and `gpt-image-2` prompt/render QA. The original source documents are useful for provenance, but placing long document excerpts directly inside runtime prompts would make behavior hard to audit, test, and reproduce.

## Decision

Store approved expert source files under `docs/expert-guidance/source-material/` and register them in `data/agent-guidance/guidance-index.json` with SHA256 hashes. Agents consume compact structured guidance packs from `data/agent-guidance/`, not raw source prose.

Generated guidance-dependent artifacts persist `guidancePackVersionIds` and `sourceGuidanceProvenance` where relevant:

- `story-workbook`
- `story-craft-report`
- `panel-plan`
- `panel-adaptation-report`
- `render-prompt`
- `rendering-guide`
- `visual-reference-pack`
- `rendered-panel-qa-decision`

The app treats critical craft, panelization, prompt, continuity, lettering, medical-traceability, and rendered-output QA failures as gate failures.

## Consequences

- The pipeline can explain which expert rules shaped a generated artifact.
- Guidance changes are versionable and testable without mutating medical evidence.
- Story and panel generation become more robust while preserving local-open, local-storage-only operation.
- Long source documents stay available for audit, but runtime prompts stay compact and rule-ID driven.

## Rejected Alternatives

- Embed the full documents in every prompt: rejected because it is brittle, expensive, and difficult to audit.
- Keep expert guidance as documentation only: rejected because the pipeline needs machine-checkable gates.
- Replace governed medical evidence with expert narrative rules: rejected because medical truth remains governed by clinical evidence objects and reviewer workflows.
