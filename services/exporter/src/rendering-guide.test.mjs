import assert from 'node:assert/strict';
import test from 'node:test';

import { buildRenderingGuide, normalizeRenderingGuide, renderRenderingGuideMarkdown } from './rendering-guide.mjs';
import { applyVisualReferencePackToRenderingGuide, buildVisualReferencePack } from './visual-reference-pack.mjs';

test('rendering guide compiler preserves panel order and emits OpenAI panel prompt blocks', () => {
  const guide = buildRenderingGuide({
    workflowRun: {
      id: 'run.demo.001',
      tenantId: 'tenant.local',
      input: {
        audienceTier: 'provider-education',
        styleProfile: 'whimsical-mystery',
      },
    },
    project: {
      title: 'Pneumonia starter project',
    },
    diseasePacket: {
      canonicalDiseaseName: 'Community-acquired pneumonia',
      clinicalSummary: {
        oneSentence: 'A lung infection should emerge through fair mystery clues before the diagnosis lands.',
        patientExperienceSummary: 'The patient feels progressively short of breath and feverish.',
        keyMechanism: 'Infectious inflammation fills alveoli and impairs gas exchange.',
        timeScale: 'hours to days',
      },
      educationalFocus: ['gas exchange', 'infectious inflammation'],
      evidence: [
        {
          claimId: 'clm.cap.001',
          claimText: 'Alveolar inflammation impairs gas exchange.',
          sourceId: 'src.cap.001',
          sourceLabel: 'Approved respiratory source',
        },
      ],
    },
    storyWorkbook: {
      id: 'swb.demo.001',
    },
    sceneCards: [],
    panelPlans: [
      {
        sceneId: 'scn.demo.001',
        panels: [
          {
            panelId: 'pnl.demo.002',
            order: 2,
            pageNumber: 2,
            storyFunction: 'clue',
            beatGoal: 'Land the first clue.',
            medicalObjective: 'Show alveolar filling without naming pneumonia.',
            location: 'alveolar district',
            bodyScale: 'tissue',
            actionSummary: 'The detectives hover over fluid-filled air sacs.',
            continuityAnchors: ['jet packs', 'alveolar walls', 'case tablet'],
            cameraFraming: 'medium shot',
            cameraAngle: 'slightly low',
            compositionNotes: 'Use diagonal vessel lines toward the affected sacs.',
            lightingMood: 'humid and tense',
            acceptanceChecks: ['alveoli are readable', 'no text in art'],
            linkedClaimIds: ['clm.cap.001'],
          },
          {
            panelId: 'pnl.demo.001',
            order: 1,
            pageNumber: 1,
            storyFunction: 'opener',
            beatGoal: 'Introduce the case.',
            medicalObjective: 'Bridge bedside symptoms to the internal setting.',
            location: 'bedside transition',
            bodyScale: 'external-world',
            actionSummary: 'The detectives enter through the shrinking portal.',
            continuityAnchors: ['portal', 'jet packs', 'case tablet'],
            cameraFraming: 'wide shot',
            cameraAngle: 'frontal',
            compositionNotes: 'Keep the portal centered with forward motion.',
            lightingMood: 'electric anticipation',
            acceptanceChecks: ['portal is clear', 'entry motion is readable'],
            linkedClaimIds: ['clm.cap.001'],
          },
        ],
      },
    ],
    renderPrompts: [
      {
        id: 'rpr.demo.001',
        panelId: 'pnl.demo.001',
        aspectRatio: '4:3',
        negativePrompt: 'no text, no labels',
        continuityAnchors: ['portal', 'jet packs', 'case tablet'],
        characterLocks: ['Detective Cyto Kine felt lead', 'Deputy Pip felt field deputy'],
        anatomyLocks: ['keep anatomy readable', 'avoid generic spaceships'],
        styleLocks: ['comic mystery', 'clean staging'],
      },
      {
        id: 'rpr.demo.002',
        panelId: 'pnl.demo.002',
        aspectRatio: '4:3',
        negativePrompt: 'no text, no labels',
        continuityAnchors: ['jet packs', 'alveolar walls', 'case tablet'],
        characterLocks: ['Detective Cyto Kine felt lead', 'Deputy Pip felt field deputy'],
        anatomyLocks: ['alveoli should be readable', 'avoid generic cave interiors'],
        styleLocks: ['comic mystery', 'clean staging'],
      },
    ],
    letteringMaps: [
      {
        id: 'ltm.demo.001',
        entries: [
          {
            entryId: 'lte.demo.001',
            panelId: 'pnl.demo.001',
            layerType: 'dialogue',
            speaker: 'Detective Cyto Kine',
            text: 'This portal better know where it is going.',
            placement: 'upper-left',
            purpose: 'Character voice',
            linkedClaimIds: ['clm.cap.001'],
          },
          {
            entryId: 'lte.demo.002',
            panelId: 'pnl.demo.002',
            layerType: 'caption',
            text: 'Fluid crowds the air sacs and raises the stakes.',
            placement: 'lower-third',
            purpose: 'Teaching overlay',
            linkedClaimIds: ['clm.cap.001'],
          },
        ],
      },
    ],
    generatedAt: '2026-04-23T15:00:00Z',
  });
  /** @type {any[]} */
  const panels = guide.panels;

  assert.deepEqual(
    panels.map((panel) => panel.panelId),
    ['pnl.demo.001', 'pnl.demo.002'],
  );
  assert.match(guide.panels[0].openAiImagePrompt.prompt, /^Create /);
  assert.match(guide.panels[0].openAiImagePrompt.prompt, /Scene and background:/);
  assert.equal(guide.providerTargets.includes('openai-gpt-image-2'), true);
  assert.equal(guide.panelExecutionStrategy.separateLetteringRequired, true);
  assert.equal(guide.panels[1].claimReferences.length, 1);

  const markdown = renderRenderingGuideMarkdown(guide);
  assert.match(markdown, /## Panel 1\.1/);
  assert.match(markdown, /### OpenAI Image Prompt/);
  assert.match(markdown, /## OpenAI Panel Execution Prompt/);
});

test('rendering guide normalization removes unsupported legacy provider fields', () => {
  const normalizedGuide = normalizeRenderingGuide({
    id: 'rgd.legacy.001',
    workflowRunId: 'run.legacy.001',
    tenantId: 'tenant.local',
    projectTitle: 'Legacy project',
    canonicalDiseaseName: 'Legacy disease',
    providerTargets: ['unsupported-legacy-provider'],
    generatedAt: '2026-04-23T15:00:00Z',
    markdownDocumentId: 'rgd.legacy.001',
    markdownLocation: 'tenant.local/rendering-guide-markdown/rgd.legacy.001.md',
    runSummary: {
      oneSentence: 'Legacy one sentence.',
      patientExperienceSummary: 'Legacy patient experience.',
      keyMechanism: 'Legacy mechanism.',
      timeScale: 'hours',
      educationalFocus: ['legacy focus'],
      audienceTier: 'general-clinical',
      styleProfile: 'legacy',
    },
    franchiseRules: ['Mystery first.'],
    continuityBible: {
      continuityAnchors: ['tablet'],
      characterLocks: ['Detective Cyto Kine'],
      anatomyLocks: ['Readable anatomy'],
      styleLocks: ['clean staging'],
      letteringPolicy: 'Separate lettering.',
    },
    globalNegativeConstraints: ['no text'],
    openAiPanelExecutionPrompt: 'Current OpenAI execution prompt.',
    retryGuidance: ['Retry carefully.'],
    panels: [{
      panelId: 'pnl.legacy.001',
      sceneId: 'scn.legacy.001',
      pageNumber: 1,
      order: 1,
      storyFunction: 'opener',
      beatGoal: 'Introduce the case.',
      medicalObjective: 'Keep the clue medically grounded.',
      location: 'legacy setting',
      bodyScale: 'tissue',
      actionSummary: 'The detectives inspect a clue.',
      cameraFraming: 'medium shot',
      cameraAngle: 'frontal',
      compositionNotes: 'Keep the clue centered.',
      lightingMood: 'tense',
      continuityAnchors: ['tablet', 'jet packs'],
      acceptanceChecks: ['No visible text'],
      claimReferences: [],
      letteringEntries: [],
      openAiImagePrompt: {
        aspectRatio: '4:3',
        prompt: 'Current OpenAI image prompt.',
        negativePrompt: 'No visible text.',
        styleLocks: ['Legacy style'],
        characterLocks: ['Legacy character'],
        anatomyLocks: ['Legacy anatomy'],
        notes: ['Legacy note'],
      },
    }],
  });

  assert.deepEqual(normalizedGuide.providerTargets, ['openai-gpt-image-2']);
  assert.equal(normalizedGuide.openAiPanelExecutionPrompt, 'Current OpenAI execution prompt.');
  assert.equal(normalizedGuide.panels[0].openAiImagePrompt.prompt, 'Current OpenAI image prompt.');
});

test('visual reference pack extraction adds Cyto, Pip, reusable props, and panel reference IDs', () => {
  const renderingGuide = {
    id: 'rgd.demo.001',
    workflowRunId: 'run.demo.001',
    tenantId: 'tenant.local',
    panels: [
      {
        panelId: 'pnl.demo.001',
        location: 'alveolar district',
        bodyScale: 'tissue',
        actionSummary: 'Detective Cyto Kine and Deputy Pip inspect a clue.',
        continuityAnchors: ['jet packs', 'case tablet'],
        openAiImagePrompt: {
          prompt: 'Create a panel with Detective Cyto Kine and Deputy Pip.',
          characterLocks: [
            'Detective Cyto Kine is the felt lead investigator with HUD visor and evidence vial',
            'Deputy Pip is the felt field deputy with micro-scanner and learner questions',
          ],
          styleLocks: ['premium cinematic 3D animated felt-toy rendering'],
        },
      },
      {
        panelId: 'pnl.demo.002',
        location: 'alveolar district',
        bodyScale: 'tissue',
        actionSummary: 'Detective Cyto Kine and Deputy Pip compare the same environment.',
        continuityAnchors: ['jet packs', 'case tablet'],
        openAiImagePrompt: {
          prompt: 'Create a panel with Detective Cyto Kine and Deputy Pip.',
          characterLocks: [
            'Detective Cyto Kine is the felt lead investigator with HUD visor and evidence vial',
            'Deputy Pip is the felt field deputy with micro-scanner and learner questions',
          ],
          styleLocks: ['premium cinematic 3D animated felt-toy rendering'],
        },
      },
    ],
  };
  const visualReferencePack = buildVisualReferencePack({
    workflowRun: {
      id: 'run.demo.001',
      tenantId: 'tenant.local',
    },
    renderingGuide,
    generatedAt: '2026-04-24T12:00:00Z',
  });
  const updatedGuide = applyVisualReferencePackToRenderingGuide(renderingGuide, visualReferencePack);

  assert.equal(visualReferencePack.items.some((/** @type {any} */ item) => item.id === 'vref.character.cyto-kine'), true);
  assert.equal(visualReferencePack.items.some((/** @type {any} */ item) => item.id === 'vref.character.pip'), true);
  assert.equal(visualReferencePack.items.some((/** @type {any} */ item) => item.itemType === 'set-piece'), true);
  assert.equal(updatedGuide.visualReferencePackId, visualReferencePack.id);
  assert.equal(updatedGuide.panels.every((/** @type {any} */ panel) => panel.visualReferenceItemIds.length > 0), true);
  assert.match(updatedGuide.panels[0].openAiImagePrompt.prompt, /Use approved visual reference item ids/u);
});
