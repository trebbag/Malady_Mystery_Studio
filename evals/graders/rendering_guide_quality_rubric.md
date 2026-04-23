# Rendering-guide-quality grader rubric

Check:
- provider-specific prompt blocks exist for every panel,
- OpenAI Image prompts begin with explicit image creation language and keep text out of the art request,
- a run-level OpenAI execution brief exists and keeps panel generation medically constrained,
- lettering overlays are explicit and editable,
- clinically important panels preserve claim traceability and continuity/anatomy locks.

Automatic fail examples:
- missing OpenAI Image prompt block for any panel,
- no explicit lettering separation,
- no run-level execution brief,
- panel instructions that allow live research or encourage text baked into art,
- clinically material panels with no claim references.
