# ADR 0013: Require an approved agent-built medical dossier before story generation

- **Status:** Accepted
- **Date:** 2026-05-08
- **Owners:** Clinical systems lead + Product lead
- **Decision type:** product + architecture

## Context

The app must accept any disease name, but the old executable path was too thin: a single research-assembly draft could create a provisional pack and continue into story, panel, and rendering prep if it passed draft thresholds. That made the UI look locally complete while underrepresenting the real work needed to collect epidemiology, etiology, pathophysiology, clinical features, exam/lab/imaging findings, diagnostic criteria, differential diagnosis, treatment, management, complications, and prognosis.

## Decision

Open disease intake now launches an OpenAI Agents SDK-backed research path when `OPENAI_API_KEY` is configured. The run persists named agent provenance (`agent-run`, `agent-step`), source discovery (`source-discovery-report`), and a first-class `medical-dossier` with required high-yield sections and claim/source traceability. Local fixture mode can still exercise the UI and storage path without a key, but it is explicitly non-pilot and fails dossier QA until reviewed and replaced or approved.

The workflow pauses at `medical-dossier-review-required` after research assembly. No story workbook, panel plan, rendering guide, render job, eval pass, or export may be treated as pilot-ready for an unseen disease until the latest medical dossier is approved by a local reviewer.

Downstream story, panel, render-prompt, rendering-guide, and visual-reference artifacts must carry `artifact-medical-provenance` so reviewers and eval gates can prove which medical dossier, agent run, source-discovery report, knowledge pack, and review decision shaped the comic. If research is regenerated, older dossier and knowledge-pack approvals become stale unless their decision records point at the latest artifact ids.

## Consequences

### Positive

- the first visible artifact for arbitrary diseases is the medical evidence base, not a comic scaffold
- reviewers can inspect source discovery, dossier coverage, claim links, and agent provenance before any story transformation
- fixture/no-key mode remains useful for development while no longer pretending to be real medical compilation

### Tradeoffs

- unseen diseases require a deliberate review click before downstream generation
- live research can be slower and more expensive because multiple specialist agent steps run before synthesis
- story/panel/render agents now preserve dossier provenance in downstream artifacts, which makes stale regenerated research easier to block before rendering or export

## Migration

Older provisional-pack runs remain readable. New open-disease runs should regenerate research outputs to create the medical dossier and then use `/api/v1/workflow-runs/{runId}/medical-dossier/review-decisions` to unlock downstream clinical/story generation.
