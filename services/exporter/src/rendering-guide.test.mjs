import assert from 'node:assert/strict';
import test from 'node:test';

import { buildRenderingGuide, renderRenderingGuideMarkdown } from './rendering-guide.mjs';

test('rendering guide compiler preserves panel order and provider-specific prompt blocks', () => {
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
        characterLocks: ['Detective A short', 'Detective B tall'],
        anatomyLocks: ['keep anatomy readable', 'avoid generic spaceships'],
        styleLocks: ['comic mystery', 'clean staging'],
      },
      {
        id: 'rpr.demo.002',
        panelId: 'pnl.demo.002',
        aspectRatio: '4:3',
        negativePrompt: 'no text, no labels',
        continuityAnchors: ['jet packs', 'alveolar walls', 'case tablet'],
        characterLocks: ['Detective A short', 'Detective B tall'],
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
            speaker: 'Detective A',
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
  assert.match(guide.panels[0].nanoBananaPrompt.prompt, /^Create /);
  assert.equal(guide.panels[0].gensparkSlide.slideNumber, 1);
  assert.equal(guide.panels[1].gensparkSlide.useOnlyProvidedContent, true);
  assert.equal(guide.panels[1].gensparkSlide.forbidLiveResearch, true);
  assert.equal(guide.panels[1].claimReferences.length, 1);

  const markdown = renderRenderingGuideMarkdown(guide);
  assert.match(markdown, /## Panel 1\.1/);
  assert.match(markdown, /### Nano Banana Pro Prompt/);
  assert.match(markdown, /### Genspark AI Slides Block/);
});
