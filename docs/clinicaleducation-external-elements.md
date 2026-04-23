# ClinicalEducation External Element Compatibility

This rebuild keeps the safe external integration surface from the previous ClinicalEducation/Malady Mystery app while preserving the current repo's contract-first pipeline.

## Legacy Source Inspected

- Local legacy app path inspected: `/Users/gregorygabbert/Documents/MaladyMyteryStudioApp`
- Closest matching legacy surface found: OpenAI-backed research/render setup, vector-store knowledge base, canon files, local run controls, and deterministic fake-mode controls.
- No secrets were copied. Only environment variable names, expected configuration shape, and portable canon guidance were carried forward.

## Supported Environment Variables

- `OPENAI_API_KEY`: backend-only secret used for live research and real `gpt-image-2` panel rendering.
- `KB_VECTOR_STORE_ID`: optional OpenAI vector-store ID reused by the research assembly service through file search.
- `OPENAI_RESEARCH_MODEL`: preferred research model override.
- `MMS_MODEL`: legacy fallback research model override when `OPENAI_RESEARCH_MODEL` is not set.
- `OPENAI_RENDER_MODEL`: active image model target, defaulting to `gpt-image-2`.
- `MMS_CANON_ROOT`: root folder containing `character_bible.md`, `series_style_bible.md`, `episode/deck_spec.md`, and `episode/episode_memory.json`.
- `MMS_CHARACTER_BIBLE_PATH`, `MMS_SERIES_STYLE_BIBLE_PATH`, `MMS_DECK_SPEC_PATH`, `MMS_EPISODE_MEMORY_PATH`: explicit canon-file overrides that take precedence over `MMS_CANON_ROOT`.
- `MMS_DISABLE_CANON_AUTO_DISCOVERY`: disables default local canon discovery when set to `1`, `true`, or `yes`.
- `MAX_CONCURRENT_RUNS`, `MMS_RUN_RETENTION_KEEP_LAST`, `MMS_PIPELINE_MODE`, `MMS_FAKE_STEP_DELAY_MS`: local run and fake-mode controls retained for operational continuity.
- `MMS_V2_KB0_TIMEOUT_MS`, `MMS_V2_STEP_AB_AGENT_TIMEOUT_MS`, `MMS_V2_STEP_C_AGENT_TIMEOUT_MS`, `MMS_V2_STEP_C_DECKSPEC_TIMEOUT_MS`, `MMS_V2_AGENT_ISOLATION_MODE`: legacy timeout/isolation knobs surfaced for compatibility and future orchestration work.
- `MMS_DETECTIVE_LEAD_NAME`, `MMS_DETECTIVE_DEPUTY_NAME`: optional overrides for the recurring detective names.

## Runtime Mapping

- The live research assembly path uses `KB_VECTOR_STORE_ID` as an OpenAI file-search vector store when `OPENAI_API_KEY` is present.
- The local no-key path remains fixture-backed and provisional; it never claims live medical research was performed.
- `/api/v1/local-runtime-view` exposes a read-only `externalElements` object so the web Settings page can show which legacy-compatible knobs are configured.
- The story engine now defaults to the recurring ClinicalEducation detective canon: Detective Cyto Kine and Deputy Pip.

## Deliberately Not Carried Forward

- No legacy secrets or local `.env` values were copied.
- Deprecated non-OpenAI active-path provider labels are not part of this rebuilt app.
- The current finished-output path remains rendered panels through the provider abstraction, with `gpt-image-2` as the OpenAI target and `stub-image` as the no-key local fallback.

