# ADR 0004: Separate art generation from lettering and dense explanatory text

- **Status:** Accepted
- **Date:** 2026-04-21
- **Owners:** Product + Art pipeline
- **Decision type:** architecture

## Context

The render pipeline needs reliable, high-quality visuals. Dense text inside generative image outputs is brittle and hard to control. The platform also needs editable dialogue, captions, labels, and late-stage localization options.

## Decision

The system will generate panel art specifications and render prompts separately from dialogue, captions, labels, and page lettering placement. The release bundle will preserve these layers as separate artifacts.

## Consequences

### Positive
- better image quality
- more controllable revisions
- easier accessibility/localization later
- clearer diffing and review

### Tradeoffs
- more asset types to manage
- layout tooling becomes more important
