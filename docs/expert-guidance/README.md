# Expert Guidance Source Layer

This directory preserves approved source material used to strengthen the local agent pipeline.

The runtime agents do not consume long raw excerpts from these files. Instead, each source is distilled into versioned guidance packs under `data/agent-guidance/`. Generated artifacts persist guidance pack IDs so story, panel, render, QA, eval, and release decisions remain auditable and reproducible.

## Imported Sources

| Source ID | Imported file | Pipeline stages |
| --- | --- | --- |
| `detective-series-master-guide` | `source-material/Detective_Series_Master_Guide.md` | story workbook, mystery review, franchise variety |
| `ai-comic-panel-breakdown-master` | `source-material/AI_Comic_Panel_Breakdown_Master_Document.docx` | scene planning, panel planning, adaptation review |
| `chatgpt-image2-slide-deck-playbook` | `source-material/comic_panel_to_chatgpt_image2_slide_deck_playbook.pdf` | render prompts, rendering guide, rendered-panel QA |

## Runtime Policy

- Keep medical claims traceable to governed evidence objects.
- Keep art generation and lettering/text placement separate.
- Cite compact guidance rule IDs in generated artifacts instead of embedding long source-document prose.
- Treat blocking craft, panelization, continuity, prompt, and rendered-output failures as gate failures.
