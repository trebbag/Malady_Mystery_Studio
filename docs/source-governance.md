# Source governance policy

This product should treat medical source quality as a product requirement.

## Source hierarchy

### Tier A — preferred
- society guidelines
- regulatory/government guidance
- major medical references
- peer-reviewed systematic reviews and landmark reviews
- internally approved clinical reference libraries

### Tier B — acceptable with care
- high-quality review articles
- specialty society educational summaries
- institutional clinical pathways

### Tier C — supplemental only
- news coverage
- general web summaries
- tertiary summaries with unclear provenance

### Prohibited for medical truth
- unsourced model memory
- random blog posts
- social media
- ad-driven health content

## Traceability rules

- Every material medical claim in a disease packet should be linked to an evidence object.
- Story and panel artifacts should reference the disease-packet claim IDs they depend on.
- Reviewer tools should allow “show me the evidence behind this panel.”
- If evidence is incomplete, the system should mark the artifact as review-required.

## Scope rule

The image model is not the source of truth for medicine. It consumes validated upstream structure.
