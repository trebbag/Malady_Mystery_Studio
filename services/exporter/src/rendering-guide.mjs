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
    styleLocks: uniqueStrings((renderPrompts ?? []).flatMap((/** @type {any} */ renderPrompt) => renderPrompt.styleLocks ?? [])),
    letteringPolicy: 'Never request visible dialogue, captions, labels, or teaching copy inside the generated art. Apply all text from the separate lettering layer after image generation or slide placement.',
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
    'If character continuity drifts, explicitly restate the detective locks and reuse the first successful panel as the style reference.',
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
    `Create a medically grounded comic-panel set for workflow run "${workflowRun.id}" from rendering guide "${renderingGuideId}".`,
    `Generate exactly ${panelCount} final panel images, one image per panel, and keep panel order stable throughout the run.`,
    'Treat the first approved successful panel as the visual continuity reference for later panels unless the guide explicitly says otherwise.',
    `Use only the supplied panel content for ${diseasePacket.canonicalDiseaseName}. Do not add new medical facts, and do not replace the supplied content with live web research.`,
    'Keep all visible dialogue, captions, labels, and teaching text out of the generated image. Those belong in the separate lettering overlay.',
    `Preserve the project title "${project.title}" and keep every panel clinically traceable to the supplied claim references.`,
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

  return {
    aspectRatio: renderPrompt.aspectRatio,
    prompt: [
      'Create a polished comic-book panel illustration.',
      `Subject and action: ${panel.actionSummary}.`,
      `Story purpose: ${panel.storyFunction}. Medical purpose: ${panel.medicalObjective}.`,
      `Environment and background: ${panel.location} at ${panel.bodyScale} scale with ${panel.lightingMood} lighting.`,
      `Composition: ${panel.cameraFraming}, ${panel.cameraAngle}, ${panel.compositionNotes}.`,
      continuityStatement ? `Continuity anchors: ${continuityStatement}.` : '',
      characterStatement ? `Character locks: ${characterStatement}.` : '',
      anatomyStatement ? `Anatomy and mechanism locks: ${anatomyStatement}.` : '',
      styleStatement ? `Style and quality locks: ${styleStatement}.` : '',
      'Leave clean space for later lettering and do not render any visible text in the image.',
    ].filter(Boolean).join(' '),
    negativePrompt: renderPrompt.negativePrompt,
    styleLocks: renderPrompt.styleLocks ?? [],
    characterLocks: renderPrompt.characterLocks ?? [],
    anatomyLocks: renderPrompt.anatomyLocks ?? [],
    notes: [
      'Start with an explicit image-creation instruction and keep the request concrete and visual.',
      'If anatomy becomes ambiguous, restate the medical objective and anatomy locks before changing style.',
      'Do not include speech bubbles, captions, labels, or teaching copy inside the generated art.',
    ],
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
    providerTargets: ['openai-gpt-image'],
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

  return guide;
}

/**
 * @param {any} renderingGuide
 * @returns {string}
 */
export function renderRenderingGuideMarkdown(renderingGuide) {
  const panelSections = renderingGuide.panels.map((/** @type {any} */ panel) => {
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
- Acceptance checks: ${panel.acceptanceChecks.join('; ')}

### Claim References
${claimLines}

### Lettering Overlay
${letteringLines}

### OpenAI Image Prompt
Aspect ratio: ${(panel.openAiImagePrompt ?? panel.nanoBananaPrompt).aspectRatio}

\`\`\`
${(panel.openAiImagePrompt ?? panel.nanoBananaPrompt).prompt}
\`\`\`

Negative prompt:

\`\`\`
${(panel.openAiImagePrompt ?? panel.nanoBananaPrompt).negativePrompt}
\`\`\`

Locks:
- Style: ${(panel.openAiImagePrompt ?? panel.nanoBananaPrompt).styleLocks.join('; ')}
- Character: ${(panel.openAiImagePrompt ?? panel.nanoBananaPrompt).characterLocks.join('; ')}
- Anatomy: ${(panel.openAiImagePrompt ?? panel.nanoBananaPrompt).anatomyLocks.join('; ')}
`;
  }).join('\n\n');

  return `# Rendering Guide ${renderingGuide.id}

- Project: ${renderingGuide.projectTitle}
- Workflow run: ${renderingGuide.workflowRunId}
- Disease: ${renderingGuide.canonicalDiseaseName}
- Generated at: ${renderingGuide.generatedAt}
- Providers: ${renderingGuide.providerTargets.join(', ')}

## Run Summary
- One sentence: ${renderingGuide.runSummary.oneSentence}
- Patient experience summary: ${renderingGuide.runSummary.patientExperienceSummary}
- Key mechanism: ${renderingGuide.runSummary.keyMechanism}
- Time scale: ${renderingGuide.runSummary.timeScale}
- Audience tier: ${renderingGuide.runSummary.audienceTier}
- Style profile: ${renderingGuide.runSummary.styleProfile}
- Educational focus: ${renderingGuide.runSummary.educationalFocus.join('; ')}

## Franchise Rules
${renderingGuide.franchiseRules.map((/** @type {string} */ rule) => `- ${rule}`).join('\n')}

## Continuity Bible
- Continuity anchors: ${renderingGuide.continuityBible.continuityAnchors.join('; ')}
- Character locks: ${renderingGuide.continuityBible.characterLocks.join('; ')}
- Anatomy locks: ${renderingGuide.continuityBible.anatomyLocks.join('; ')}
- Style locks: ${renderingGuide.continuityBible.styleLocks.join('; ')}
- Lettering policy: ${renderingGuide.continuityBible.letteringPolicy}

## Global Negative Constraints
${renderingGuide.globalNegativeConstraints.map((/** @type {string} */ constraint) => `- ${constraint}`).join('\n')}

## OpenAI Panel Execution Prompt
\`\`\`
${renderingGuide.openAiPanelExecutionPrompt ?? renderingGuide.gensparkDeckBootstrapPrompt}
\`\`\`

## Retry Guidance
${renderingGuide.retryGuidance.map((/** @type {string} */ rule) => `- ${rule}`).join('\n')}

${panelSections}
`;
}
