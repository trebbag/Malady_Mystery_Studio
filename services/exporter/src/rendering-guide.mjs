import { createId } from '../../../packages/shared-config/src/ids.mjs';

const SCHEMA_VERSION = '1.0.0';

/**
 * @param {unknown[]} values
 * @returns {string[]}
 */
function uniqueStrings(values) {
  return [...new Set(values
    .filter((/** @type {unknown} */ value) => typeof value === 'string' && value.trim().length > 0)
    .map((/** @type {unknown} */ value) => String(value).trim()))];
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function splitNegativePrompt(value) {
  return uniqueStrings(String(value ?? '').split(','));
}

/**
 * @param {any} diseasePacket
 * @returns {Map<string, { claimId: string, claimText: string, sourceId: string, sourceLabel: string }>}
 */
function buildClaimReferenceMap(diseasePacket) {
  return new Map(
    (diseasePacket?.evidence ?? []).map((/** @type {any} */ record) => [
      record.claimId,
      {
        claimId: record.claimId,
        claimText: record.claimText,
        sourceId: record.sourceId,
        sourceLabel: record.sourceLabel,
      },
    ]),
  );
}

/**
 * @param {any[]} letteringMaps
 * @returns {Map<string, any[]>}
 */
function buildLetteringByPanel(letteringMaps) {
  const letteringByPanel = new Map();

  for (const letteringMap of letteringMaps ?? []) {
    for (const entry of letteringMap.entries ?? []) {
      const entries = letteringByPanel.get(entry.panelId) ?? [];
      entries.push({
        entryId: entry.entryId,
        layerType: entry.layerType,
        speaker: entry.speaker,
        text: entry.text,
        placement: entry.placement,
        purpose: entry.purpose,
        spoilerLevel: entry.spoilerLevel,
        linkedClaimIds: entry.linkedClaimIds ?? [],
      });
      letteringByPanel.set(entry.panelId, entries);
    }
  }

  return letteringByPanel;
}

/**
 * @param {any[]} renderPrompts
 * @returns {Map<string, any>}
 */
function buildRenderPromptByPanel(renderPrompts) {
  return new Map((renderPrompts ?? []).map((/** @type {any} */ renderPrompt) => [renderPrompt.panelId, renderPrompt]));
}

/**
 * @param {any[]} renderPrompts
 * @returns {{ continuityAnchors: string[], characterLocks: string[], anatomyLocks: string[], styleLocks: string[], letteringPolicy: string }}
 */
function buildContinuityBible(renderPrompts) {
  return {
    continuityAnchors: uniqueStrings((renderPrompts ?? []).flatMap((/** @type {any} */ renderPrompt) => renderPrompt.continuityAnchors ?? [])),
    characterLocks: uniqueStrings((renderPrompts ?? []).flatMap((/** @type {any} */ renderPrompt) => renderPrompt.characterLocks ?? [])),
    anatomyLocks: uniqueStrings((renderPrompts ?? []).flatMap((/** @type {any} */ renderPrompt) => renderPrompt.anatomyLocks ?? [])),
    styleLocks: uniqueStrings([
      'premium cinematic 3D animated felt-toy rendering',
      'warm feature-animation lighting with soft tactile fibers',
      'stable character silhouettes, expressive eyes, subtle stitching, and consistent prop scale',
      ...(renderPrompts ?? []).flatMap((/** @type {any} */ renderPrompt) => renderPrompt.styleLocks ?? []),
    ]),
    letteringPolicy: 'Never request visible dialogue, captions, labels, or teaching copy inside the generated art. Apply all text from the separate lettering layer after image generation.',
  };
}

function buildFranchiseRules() {
  return [
    'Mystery first: observation and suspicion should lead before explicit naming.',
    'Diagnosis must be earned through clues, not front-loaded as a title card.',
    'Treatment is the action climax and should resolve the mechanism uncovered in the reveal.',
    'The wrap-up must echo the opener so the franchise loop closes cleanly.',
    'Keep art and lettering separate. Do not place large visible text inside generated image prompts.',
  ];
}

/**
 * @param {any} workflowRun
 * @param {any} diseasePacket
 * @returns {{ oneSentence: string, patientExperienceSummary: string, keyMechanism: string, timeScale: string, educationalFocus: string[], audienceTier: string, styleProfile: string }}
 */
function buildRunSummary(workflowRun, diseasePacket) {
  return {
    oneSentence: diseasePacket.clinicalSummary.oneSentence,
    patientExperienceSummary: diseasePacket.clinicalSummary.patientExperienceSummary,
    keyMechanism: diseasePacket.clinicalSummary.keyMechanism,
    timeScale: diseasePacket.clinicalSummary.timeScale,
    educationalFocus: diseasePacket.educationalFocus ?? [],
    audienceTier: workflowRun.input.audienceTier ?? 'general-clinical',
    styleProfile: workflowRun.input.styleProfile ?? 'whimsical-mystery-clinical',
  };
}

function buildGlobalRetryGuidance() {
  return [
    'If a panel loses anatomy clarity, simplify the composition before weakening the medical objective.',
    'If character continuity drifts, explicitly restate the detective locks and reuse the first approved successful panel as the style reference.',
    'If the model adds visible text, remove all requested text from the art prompt and keep overlays in the lettering instructions only.',
    'If a panel fails repeatedly, keep the clinical objective fixed and tighten only composition, continuity, and anatomy locks.',
  ];
}

/**
 * @param {any} project
 * @param {any} workflowRun
 * @param {any} diseasePacket
 * @param {string} renderingGuideId
 * @param {number} panelCount
 * @returns {string}
 */
function buildOpenAiPanelExecutionPrompt(project, workflowRun, diseasePacket, renderingGuideId, panelCount) {
  return [
    `Create the final panel image set for workflow run "${workflowRun.id}" from rendering guide "${renderingGuideId}".`,
    `Generate exactly ${panelCount} finished panel images, one panel at a time, and keep page and panel order stable throughout the run.`,
    'Treat the first approved successful panel as the visual continuity reference for every later panel unless the guide explicitly overrides it.',
    `Use only the supplied panel content for ${diseasePacket.canonicalDiseaseName}. Do not add new medical facts, and do not replace the supplied content with live web research.`,
    'For each panel, follow this order: scene and background first, then subject and action, then key medical details, then framing, lighting, style, and constraints.',
    'Keep all visible dialogue, captions, labels, and teaching text out of the generated image. Those belong in the separate lettering overlay.',
    `Preserve the project title "${project.title}" and keep every clinically meaningful visual choice traceable to the supplied claim references.`,
  ].join(' ');
}

/**
 * @param {any} panel
 * @param {any} renderPrompt
 * @returns {{ aspectRatio: string, prompt: string, negativePrompt: string, styleLocks: string[], characterLocks: string[], anatomyLocks: string[], notes: string[] }}
 */
function buildOpenAiImagePrompt(panel, renderPrompt) {
  const continuityStatement = uniqueStrings(renderPrompt.continuityAnchors ?? []).join('; ');
  const characterStatement = uniqueStrings(renderPrompt.characterLocks ?? []).join('; ');
  const anatomyStatement = uniqueStrings(renderPrompt.anatomyLocks ?? []).join('; ');
  const styleStatement = uniqueStrings(renderPrompt.styleLocks ?? []).join('; ');
  const visualReferenceStatement = uniqueStrings(renderPrompt.visualReferenceItemIds ?? panel.visualReferenceItemIds ?? []).join(', ');

  return {
    aspectRatio: renderPrompt.aspectRatio,
    prompt: [
      'Create a premium cinematic 3D animated felt-toy finished comic-book panel illustration.',
      `Scene and background: ${panel.location} at ${panel.bodyScale} scale.`,
      `Subject and action: ${panel.actionSummary}.`,
      `Key medical details: ${panel.medicalObjective}. Story purpose: ${panel.storyFunction}.`,
      `Camera and composition: ${panel.cameraFraming}, ${panel.cameraAngle}, ${panel.compositionNotes}.`,
      `Lighting and atmosphere: ${panel.lightingMood}.`,
      continuityStatement ? `Continuity anchors: ${continuityStatement}.` : '',
      characterStatement ? `Character locks: ${characterStatement}.` : '',
      anatomyStatement ? `Anatomy and mechanism locks: ${anatomyStatement}.` : '',
      styleStatement ? `Style and finish locks: ${styleStatement}.` : '',
      visualReferenceStatement ? `Approved visual reference item ids to preserve: ${visualReferenceStatement}.` : '',
      'Leave clean space for later lettering and do not render any visible text in the image.',
    ].filter(Boolean).join(' '),
    negativePrompt: renderPrompt.negativePrompt,
    styleLocks: renderPrompt.styleLocks ?? [],
    characterLocks: renderPrompt.characterLocks ?? [],
    anatomyLocks: renderPrompt.anatomyLocks ?? [],
    notes: [
      'Start with an explicit image-creation instruction and keep the request concrete, skimmable, and visual.',
      'State scene/background before subject/action so the model anchors the environment before the characters move.',
      'Call out camera, lighting, and medical mechanism locks explicitly when fidelity is more important than stylistic variation.',
      'If anatomy becomes ambiguous, restate the medical objective and anatomy locks before changing style.',
      'Do not include speech bubbles, captions, labels, or teaching copy inside the generated art.',
      'Do not generate final panel art until the latest rendering guide and visual reference pack are explicitly approved.',
    ],
  };
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function normalizeStringArray(value) {
  return Array.isArray(value)
    ? uniqueStrings(value)
    : [];
}

/**
 * @param {any} prompt
 * @returns {any}
 */
function normalizeOpenAiPrompt(prompt) {
  return {
    aspectRatio: String(prompt?.aspectRatio ?? '4:3'),
    prompt: String(prompt?.prompt ?? ''),
    negativePrompt: String(prompt?.negativePrompt ?? ''),
    styleLocks: normalizeStringArray(prompt?.styleLocks),
    characterLocks: normalizeStringArray(prompt?.characterLocks),
    anatomyLocks: normalizeStringArray(prompt?.anatomyLocks),
    notes: normalizeStringArray(prompt?.notes),
  };
}

/**
 * @param {any} panel
 * @returns {any}
 */
function normalizeRenderingGuidePanel(panel) {
  const rest = panel ?? {};

  return {
    ...rest,
    continuityAnchors: normalizeStringArray(rest.continuityAnchors),
    linkedClaimIds: normalizeStringArray(rest.linkedClaimIds),
    visualReferenceItemIds: normalizeStringArray(rest.visualReferenceItemIds),
    acceptanceChecks: normalizeStringArray(rest.acceptanceChecks),
    claimReferences: Array.isArray(rest.claimReferences) ? rest.claimReferences : [],
    letteringEntries: Array.isArray(rest.letteringEntries) ? rest.letteringEntries : [],
    openAiImagePrompt: normalizeOpenAiPrompt(rest.openAiImagePrompt),
  };
}

/**
 * @param {any} renderingGuide
 * @returns {any}
 */
export function normalizeRenderingGuide(renderingGuide) {
  if (!renderingGuide || typeof renderingGuide !== 'object') {
    return renderingGuide;
  }

  const {
    panels,
    panelExecutionStrategy,
    continuityBible,
    franchiseRules,
    retryGuidance,
    globalNegativeConstraints,
    ...rest
  } = renderingGuide;

  return {
    ...rest,
    providerTargets: ['openai-gpt-image-2'],
    reviewStatus: rest.reviewStatus ?? 'not-reviewed',
    ...(rest.visualReferencePackId ? { visualReferencePackId: rest.visualReferencePackId } : {}),
    ...(rest.referenceCoverageSummary ? { referenceCoverageSummary: rest.referenceCoverageSummary } : {}),
    franchiseRules: normalizeStringArray(franchiseRules),
    continuityBible: {
      continuityAnchors: normalizeStringArray(continuityBible?.continuityAnchors),
      characterLocks: normalizeStringArray(continuityBible?.characterLocks),
      anatomyLocks: normalizeStringArray(continuityBible?.anatomyLocks),
      styleLocks: normalizeStringArray(continuityBible?.styleLocks),
      letteringPolicy: String(continuityBible?.letteringPolicy ?? 'Never request visible lettering in generated art; preserve lettering as a separate overlay.'),
    },
    panelExecutionStrategy: {
      sequentialPanelExecutionRecommended: panelExecutionStrategy?.sequentialPanelExecutionRecommended ?? true,
      continuityReferenceRequired: panelExecutionStrategy?.continuityReferenceRequired ?? true,
      separateLetteringRequired: panelExecutionStrategy?.separateLetteringRequired ?? true,
      manualReviewRequired: panelExecutionStrategy?.manualReviewRequired ?? true,
    },
    globalNegativeConstraints: normalizeStringArray(globalNegativeConstraints),
    openAiPanelExecutionPrompt: String(rest.openAiPanelExecutionPrompt ?? ''),
    retryGuidance: normalizeStringArray(retryGuidance),
    panels: Array.isArray(panels) ? panels.map((panel) => normalizeRenderingGuidePanel(panel)) : [],
  };
}

/**
 * @param {{
 *   workflowRun: any,
 *   project: any,
 *   diseasePacket: any,
 *   storyWorkbook: any,
 *   sceneCards: any[],
 *   panelPlans: any[],
 *   renderPrompts: any[],
 *   letteringMaps: any[],
 *   generatedAt: string,
 * }} options
 * @returns {any}
 */
export function buildRenderingGuide(options) {
  const claimReferenceMap = buildClaimReferenceMap(options.diseasePacket);
  const renderPromptByPanel = buildRenderPromptByPanel(options.renderPrompts);
  const letteringByPanel = buildLetteringByPanel(options.letteringMaps);
  const continuityBible = buildContinuityBible(options.renderPrompts);
  const globalNegativeConstraints = splitNegativePrompt(options.renderPrompts?.[0]?.negativePrompt ?? '');
  const panels = (options.panelPlans ?? [])
    .flatMap((/** @type {any} */ panelPlan) => panelPlan.panels.map((/** @type {any} */ panel) => ({
      ...panel,
      sceneId: panelPlan.sceneId,
    })))
    .sort((/** @type {any} */ left, /** @type {any} */ right) => left.pageNumber - right.pageNumber || left.order - right.order)
    .map((/** @type {any} */ panel) => {
      const renderPrompt = renderPromptByPanel.get(panel.panelId);

      if (!renderPrompt) {
        throw new Error(`Render prompt missing for panel ${panel.panelId}.`);
      }

      const letteringEntries = letteringByPanel.get(panel.panelId) ?? [];
      const linkedClaimIds = panel.linkedClaimIds ?? renderPrompt.linkedClaimIds ?? [];
      const visualReferenceItemIds = renderPrompt.visualReferenceItemIds ?? [];

      return {
        panelId: panel.panelId,
        sceneId: panel.sceneId,
        pageNumber: panel.pageNumber,
        order: panel.order,
        storyFunction: panel.storyFunction,
        beatGoal: panel.beatGoal,
        medicalObjective: panel.medicalObjective,
        location: panel.location,
        bodyScale: panel.bodyScale,
        actionSummary: panel.actionSummary,
        ...(panel.clueRevealed ? { clueRevealed: panel.clueRevealed } : {}),
        cameraFraming: panel.cameraFraming,
        cameraAngle: panel.cameraAngle,
        compositionNotes: panel.compositionNotes,
        lightingMood: panel.lightingMood,
        continuityAnchors: panel.continuityAnchors ?? [],
        linkedClaimIds,
        visualReferenceItemIds,
        acceptanceChecks: panel.acceptanceChecks ?? [],
        claimReferences: linkedClaimIds
          .map((/** @type {string} */ claimId) => claimReferenceMap.get(claimId))
          .filter(Boolean),
        letteringEntries,
        openAiImagePrompt: buildOpenAiImagePrompt(panel, renderPrompt),
      };
    });

  const guide = {
    schemaVersion: SCHEMA_VERSION,
    id: createId('rgd'),
    workflowRunId: options.workflowRun.id,
    tenantId: options.workflowRun.tenantId,
    projectTitle: options.project.title,
    canonicalDiseaseName: options.diseasePacket.canonicalDiseaseName,
    providerTargets: ['openai-gpt-image-2'],
    generatedAt: options.generatedAt,
    markdownDocumentId: '',
    markdownLocation: '',
    runSummary: buildRunSummary(options.workflowRun, options.diseasePacket),
    franchiseRules: buildFranchiseRules(),
    continuityBible,
    panelExecutionStrategy: {
      sequentialPanelExecutionRecommended: true,
      continuityReferenceRequired: true,
      separateLetteringRequired: true,
      manualReviewRequired: true,
    },
    globalNegativeConstraints,
    openAiPanelExecutionPrompt: buildOpenAiPanelExecutionPrompt(
      options.project,
      options.workflowRun,
      options.diseasePacket,
      'pending-rendering-guide-id',
      panels.length,
    ),
    retryGuidance: buildGlobalRetryGuidance(),
    panels,
  };

  guide.openAiPanelExecutionPrompt = buildOpenAiPanelExecutionPrompt(
    options.project,
    options.workflowRun,
    options.diseasePacket,
    guide.id,
    panels.length,
  );

  return normalizeRenderingGuide(guide);
}

/**
 * @param {any} renderingGuide
 * @returns {string}
 */
export function renderRenderingGuideMarkdown(renderingGuide) {
  const normalizedGuide = normalizeRenderingGuide(renderingGuide);
  const panelSections = normalizedGuide.panels.map((/** @type {any} */ panel) => {
    const claimLines = panel.claimReferences.length > 0
      ? panel.claimReferences.map((/** @type {any} */ claimReference) => (
        `- ${claimReference.claimId}: ${claimReference.claimText} (${claimReference.sourceLabel})`
      )).join('\n')
      : '- No claim references were attached.';
    const letteringLines = panel.letteringEntries.length > 0
      ? panel.letteringEntries.map((/** @type {any} */ entry) => (
        `- ${entry.layerType}${entry.speaker ? ` / ${entry.speaker}` : ''}: "${entry.text}" at ${entry.placement}`
      )).join('\n')
      : '- No lettering entries were attached.';

    return `## Panel ${panel.pageNumber}.${panel.order} — ${panel.panelId}

- Scene: ${panel.sceneId}
- Story function: ${panel.storyFunction}
- Beat goal: ${panel.beatGoal}
- Medical objective: ${panel.medicalObjective}
- Location: ${panel.location}
- Body scale: ${panel.bodyScale}
- Action summary: ${panel.actionSummary}
- Camera framing: ${panel.cameraFraming}
- Camera angle: ${panel.cameraAngle}
- Composition notes: ${panel.compositionNotes}
- Lighting mood: ${panel.lightingMood}
${panel.clueRevealed ? `- Clue revealed: ${panel.clueRevealed}\n` : ''}- Continuity anchors: ${panel.continuityAnchors.join('; ')}
- Visual reference item ids: ${(panel.visualReferenceItemIds ?? []).join(', ') || 'not assigned'}
- Acceptance checks: ${panel.acceptanceChecks.join('; ')}

### Claim References
${claimLines}

### Lettering Overlay
${letteringLines}

### OpenAI Image Prompt
Aspect ratio: ${panel.openAiImagePrompt.aspectRatio}

\`\`\`
${panel.openAiImagePrompt.prompt}
\`\`\`

Negative prompt:

\`\`\`
${panel.openAiImagePrompt.negativePrompt}
\`\`\`

Locks:
- Style: ${panel.openAiImagePrompt.styleLocks.join('; ')}
- Character: ${panel.openAiImagePrompt.characterLocks.join('; ')}
- Anatomy: ${panel.openAiImagePrompt.anatomyLocks.join('; ')}
`;
  }).join('\n\n');

  return `# Rendering Guide ${normalizedGuide.id}

- Project: ${normalizedGuide.projectTitle}
- Workflow run: ${normalizedGuide.workflowRunId}
- Disease: ${normalizedGuide.canonicalDiseaseName}
- Generated at: ${normalizedGuide.generatedAt}
- Providers: ${normalizedGuide.providerTargets.join(', ')}
- Review status: ${normalizedGuide.reviewStatus ?? 'not-reviewed'}
- Visual reference pack: ${normalizedGuide.visualReferencePackId ?? 'not-generated'}

## Run Summary
- One sentence: ${normalizedGuide.runSummary.oneSentence}
- Patient experience summary: ${normalizedGuide.runSummary.patientExperienceSummary}
- Key mechanism: ${normalizedGuide.runSummary.keyMechanism}
- Time scale: ${normalizedGuide.runSummary.timeScale}
- Audience tier: ${normalizedGuide.runSummary.audienceTier}
- Style profile: ${normalizedGuide.runSummary.styleProfile}
- Educational focus: ${normalizedGuide.runSummary.educationalFocus.join('; ')}

## Franchise Rules
${normalizedGuide.franchiseRules.map((/** @type {string} */ rule) => `- ${rule}`).join('\n')}

## Continuity Bible
- Continuity anchors: ${normalizedGuide.continuityBible.continuityAnchors.join('; ')}
- Character locks: ${normalizedGuide.continuityBible.characterLocks.join('; ')}
- Anatomy locks: ${normalizedGuide.continuityBible.anatomyLocks.join('; ')}
- Style locks: ${normalizedGuide.continuityBible.styleLocks.join('; ')}
- Lettering policy: ${normalizedGuide.continuityBible.letteringPolicy}

## Visual Reference Coverage
${normalizedGuide.referenceCoverageSummary ? [
    `- Panels with references: ${normalizedGuide.referenceCoverageSummary.panelsWithReferenceItems}/${normalizedGuide.referenceCoverageSummary.panelCount}`,
    `- Required characters present: ${normalizedGuide.referenceCoverageSummary.presentCharacterItems}/${normalizedGuide.referenceCoverageSummary.requiredCharacterItems}`,
    `- Recurring references: ${normalizedGuide.referenceCoverageSummary.recurringItemCount}`,
    ...(normalizedGuide.referenceCoverageSummary.warnings ?? []).map((/** @type {string} */ warning) => `- Warning: ${warning}`),
  ].join('\n') : '- Visual reference pack has not been generated.'}

## Global Negative Constraints
${normalizedGuide.globalNegativeConstraints.map((/** @type {string} */ constraint) => `- ${constraint}`).join('\n')}

## OpenAI Panel Execution Prompt
\`\`\`
${normalizedGuide.openAiPanelExecutionPrompt}
\`\`\`

## Retry Guidance
${normalizedGuide.retryGuidance.map((/** @type {string} */ rule) => `- ${rule}`).join('\n')}

${panelSections}
`;
}
