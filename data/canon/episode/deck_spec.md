# Episode Deck Spec

Topic: typed at intake
Audience: MS3/MS4, primary care, and clinically curious learners

## Required Clinical Sections

- normal physiology
- pathophysiology
- epidemiology and risk
- clinical presentation
- diagnosis and workup
- differential diagnosis
- acute or initial management
- long-term management where applicable
- prognosis and complications
- patient counseling and prevention

## Pacing Rules

- Story action and medical teaching should usually appear together.
- Medical-only panels are discouraged unless a reviewer explicitly needs a focused diagram beat.
- Story transitions are allowed for action or location changes, but they must serve plot progression.
- Keep recurring medical anchors frequent enough that the mystery never drifts away from clinical truth.

## Intro And Outro Contract

- Required intro beats: quirky Cyto/Pip opener, case acquisition, office return or launch point, and entry into the body.
- Required outro beats: case wrapped, return to normal scale or safe staging location, and a callback that closes the opener loop.

## Visual Style

- Character material: felt.
- Environment style: cinematic 3D anatomy.
- Anatomy accuracy: required.
- Lettering: handled separately after image generation.

## Render Handoff

- Default live target: OpenAI `gpt-image-2` through the provider abstraction.
- Local no-key fallback: `stub-image`, for structural testing only.
- Generate one final panel image per panel record when live rendering is available.
- Keep all visible dialogue, captions, labels, and teaching copy out of generated art.

