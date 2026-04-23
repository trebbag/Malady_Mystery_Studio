import assert from 'node:assert/strict';
import test from 'node:test';

import { findRepoRoot } from '../../../packages/shared-config/src/repo-paths.mjs';
import { createSchemaRegistry } from '../../../packages/shared-config/src/schema-registry.mjs';
import { createClinicalRetrievalService } from '../../clinical-retrieval/src/service.mjs';
import {
  compareStoryMemories,
  createQaReportFromNarrativeReviewTrace,
  createStoryEngineService,
  reviewEducationalSequencing,
  reviewMysteryIntegrity,
  reviewPanelPlans,
  reviewRenderPrompts,
  reviewSceneCards,
} from './service.mjs';

const clinicalService = createClinicalRetrievalService();
const storyEngine = createStoryEngineService();
const rootDir = findRepoRoot(import.meta.url);

/**
 * @returns {Promise<any>}
 */
async function loadSchemaRegistry() {
  return createSchemaRegistry(rootDir);
}

/**
 * @param {string} diseaseName
 * @returns {any}
 */
function createDiseasePacket(diseaseName) {
  const canonicalDisease = clinicalService.canonicalizeDiseaseInput(diseaseName);
  return clinicalService.buildDiseasePacket(canonicalDisease);
}

test('story engine generates a workbook package that validates against repo contracts', async () => {
  const diseasePacket = createDiseasePacket('hepatocellular carcinoma');
  const schemaRegistry = await loadSchemaRegistry();
  const generatedPackage = storyEngine.generateStoryWorkbookPackage(diseasePacket, {
    styleProfile: 'whimsical-mystery',
    workflowRunId: 'run.test.001',
    existingStoryMemories: [],
    timestamp: '2026-04-21T00:00:00Z',
  });

  schemaRegistry.assertValid('contracts/story-workbook.schema.json', generatedPackage.storyWorkbook);
  schemaRegistry.assertValid('contracts/story-memory.schema.json', generatedPackage.storyMemory);
  schemaRegistry.assertValid('contracts/narrative-review-trace.schema.json', generatedPackage.narrativeReviewTrace);
  schemaRegistry.assertValid('contracts/qa-report.schema.json', generatedPackage.qaReport);

  assert.equal(generatedPackage.storyWorkbook.grandReveal.diagnosisName, 'Hepatocellular carcinoma');
  assert.equal(generatedPackage.storyWorkbook.clueLadder.length >= 4, true);
  assert.equal(generatedPackage.narrativeReviewTrace.verdict, 'pass');
});

test('mystery guardrails catch early diagnosis leaks', () => {
  const diseasePacket = createDiseasePacket('myasthenia gravis');
  const generatedPackage = storyEngine.generateStoryWorkbookPackage(diseasePacket, {
    styleProfile: 'whimsical-mystery',
    existingStoryMemories: [],
    timestamp: '2026-04-21T00:00:00Z',
  });

  const leakedWorkbook = {
    ...generatedPackage.storyWorkbook,
    storyTitle: 'Myasthenia gravis solves itself in chapter one',
  };
  const review = reviewMysteryIntegrity(leakedWorkbook, diseasePacket);

  assert.equal(review.findings.some((/** @type {{ ruleId: string }} */ finding) => finding.ruleId === 'diagnosis-leak-before-reveal'), true);
  assert.equal(review.score < 1, true);
});

test('educational sequencing guardrails catch diagnostic jargon before discovery', () => {
  const diseasePacket = createDiseasePacket('hepatocellular carcinoma');
  const generatedPackage = storyEngine.generateStoryWorkbookPackage(diseasePacket, {
    styleProfile: 'cinematic-sci-fi',
    existingStoryMemories: [],
    timestamp: '2026-04-21T00:00:00Z',
  });

  const jargonWorkbook = {
    ...generatedPackage.storyWorkbook,
    clueLadder: generatedPackage.storyWorkbook.clueLadder.map((/** @type {any} */ clue, /** @type {number} */ index) => (
      index === 0
        ? {
          ...clue,
          clue: 'Alpha-fetoprotein and multiphasic liver imaging already prove the answer.',
          discoveryMode: 'lab',
        }
        : clue
    )),
  };
  const review = reviewEducationalSequencing(jargonWorkbook, diseasePacket);

  assert.equal(
    review.findings.some((/** @type {{ ruleId: string }} */ finding) => finding.ruleId === 'pathognomonic-jargon-before-discovery'),
    true,
  );
  assert.equal(review.score < 1, true);
});

test('story memory comparison warns when opener and ending overlap too closely', () => {
  const diseasePacket = createDiseasePacket('community-acquired pneumonia');
  const firstPackage = storyEngine.generateStoryWorkbookPackage(diseasePacket, {
    styleProfile: 'playful-detective',
    existingStoryMemories: [],
    timestamp: '2026-04-21T00:00:00Z',
  });
  const secondPackage = storyEngine.generateStoryWorkbookPackage(diseasePacket, {
    styleProfile: 'playful-detective',
    existingStoryMemories: [firstPackage.storyMemory],
    timestamp: '2026-04-21T00:05:00Z',
  });
  const noveltyReview = compareStoryMemories(secondPackage.storyMemory, [firstPackage.storyMemory]);

  assert.equal(noveltyReview.findings.length > 0, true);
  assert.equal(noveltyReview.score < 1, true);
});

test('narrative review traces can be converted into a QA report', async () => {
  const diseasePacket = createDiseasePacket('diabetic ketoacidosis');
  const generatedPackage = storyEngine.generateStoryWorkbookPackage(diseasePacket, {
    styleProfile: 'cinematic-sci-fi',
    existingStoryMemories: [],
    timestamp: '2026-04-21T00:00:00Z',
  });
  const schemaRegistry = await loadSchemaRegistry();
  const qaReport = createQaReportFromNarrativeReviewTrace(
    generatedPackage.narrativeReviewTrace,
    generatedPackage.storyWorkbook,
    diseasePacket,
    '2026-04-21T00:00:00Z',
  );

  schemaRegistry.assertValid('contracts/qa-report.schema.json', qaReport);
  assert.equal(qaReport.subjectType, 'story-workbook');
  assert.equal(qaReport.warnings.some((/** @type {string} */ warning) => warning.includes('workbook-stage projections')), true);
});

test('visual planning package generates valid scene, panel, render, lettering, and workflow QA artifacts', async () => {
  const diseasePacket = createDiseasePacket('community-acquired pneumonia');
  const workbookPackage = storyEngine.generateStoryWorkbookPackage(diseasePacket, {
    styleProfile: 'playful-detective',
    workflowRunId: 'run.test.201',
    existingStoryMemories: [],
    timestamp: '2026-04-21T00:00:00Z',
  });
  const visualPackage = storyEngine.generateVisualPlanningPackage(
    diseasePacket,
    workbookPackage.storyWorkbook,
    workbookPackage.qaReport,
    {
      workflowRunId: 'run.test.201',
      styleProfile: 'playful-detective',
      timestamp: '2026-04-21T00:01:00Z',
    },
  );
  const schemaRegistry = await loadSchemaRegistry();

  assert.equal(visualPackage.sceneCards.length >= 8, true);
  assert.equal(visualPackage.panelPlans.length, visualPackage.sceneCards.length);
  assert.equal(visualPackage.letteringMaps.length, visualPackage.panelPlans.length);
  assert.equal(visualPackage.renderPrompts.length > visualPackage.panelPlans.length, true);

  for (const sceneCard of visualPackage.sceneCards) {
    schemaRegistry.assertValid('contracts/scene-card.schema.json', sceneCard);
  }

  for (const panelPlan of visualPackage.panelPlans) {
    schemaRegistry.assertValid('contracts/panel-plan.schema.json', panelPlan);
  }

  for (const renderPrompt of visualPackage.renderPrompts) {
    schemaRegistry.assertValid('contracts/render-prompt.schema.json', renderPrompt);
  }

  for (const letteringMap of visualPackage.letteringMaps) {
    schemaRegistry.assertValid('contracts/lettering-map.schema.json', letteringMap);
  }

  schemaRegistry.assertValid('contracts/qa-report.schema.json', visualPackage.qaReport);
  assert.equal(visualPackage.sceneCards[0].act, 'opener');
  assert.equal(visualPackage.sceneCards[visualPackage.sceneCards.length - 1].act, 'wrap-up');
  assert.equal(visualPackage.qaReport.subjectType, 'workflow-run');
});

test('scene review preserves opener-to-wrap-up ordering', () => {
  const diseasePacket = createDiseasePacket('hepatocellular carcinoma');
  const workbookPackage = storyEngine.generateStoryWorkbookPackage(diseasePacket, {
    styleProfile: 'whimsical-mystery',
    workflowRunId: 'run.test.202',
    existingStoryMemories: [],
    timestamp: '2026-04-21T00:00:00Z',
  });
  const visualPackage = storyEngine.generateVisualPlanningPackage(
    diseasePacket,
    workbookPackage.storyWorkbook,
    workbookPackage.qaReport,
    {
      workflowRunId: 'run.test.202',
      styleProfile: 'whimsical-mystery',
      timestamp: '2026-04-21T00:01:00Z',
    },
  );
  const review = reviewSceneCards(visualPackage.sceneCards);

  assert.equal(review.score, 1);
  assert.equal(review.findings.length, 0);
});

test('panel review catches obvious flipbook repetition', () => {
  const repetitivePanelPlans = [
    {
      schemaVersion: '1.0.0',
      id: 'ppl.demo.001',
      sceneId: 'scn.demo.001',
      pageRange: {
        startPage: 1,
        endPage: 1,
      },
      panels: [
        {
          panelId: 'pnl.demo.001',
          order: 1,
          pageNumber: 1,
          storyFunction: 'clue',
          beatGoal: 'Reveal the anomaly.',
          medicalObjective: 'Show the first clue.',
          location: 'same corridor',
          bodyScale: 'organ',
          charactersPresent: ['Detective Cyto Kine', 'Deputy Pip'],
          actionSummary: 'They stare at the same anomaly.',
          continuityAnchors: ['same corridor', 'case tablet'],
          cameraFraming: 'medium shot',
          cameraAngle: 'straight-on',
          compositionNotes: 'Center the clue.',
          lightingMood: 'tense',
          renderIntent: 'Clue panel',
          acceptanceChecks: ['readable clue'],
        },
        {
          panelId: 'pnl.demo.002',
          order: 2,
          pageNumber: 1,
          storyFunction: 'clue',
          beatGoal: 'Reveal the anomaly again.',
          medicalObjective: 'Repeat the same clue.',
          location: 'same corridor',
          bodyScale: 'organ',
          charactersPresent: ['Detective Cyto Kine', 'Deputy Pip'],
          actionSummary: 'They stare at the same anomaly again.',
          continuityAnchors: ['same corridor', 'case tablet'],
          cameraFraming: 'medium shot',
          cameraAngle: 'straight-on',
          compositionNotes: 'Center the clue again.',
          lightingMood: 'tense',
          renderIntent: 'Repeated clue panel',
          acceptanceChecks: ['readable clue'],
        },
      ],
    },
  ];
  const review = reviewPanelPlans(repetitivePanelPlans);

  assert.equal(review.findings.some((/** @type {{ ruleId: string }} */ finding) => finding.ruleId === 'flipbook-repetition-risk'), true);
  assert.equal(review.score < 1, true);
});

test('render prompts keep text out of art while lettering maps carry the copy', () => {
  const diseasePacket = createDiseasePacket('myasthenia gravis');
  const workbookPackage = storyEngine.generateStoryWorkbookPackage(diseasePacket, {
    styleProfile: 'cinematic-sci-fi',
    workflowRunId: 'run.test.203',
    existingStoryMemories: [],
    timestamp: '2026-04-21T00:00:00Z',
  });
  const visualPackage = storyEngine.generateVisualPlanningPackage(
    diseasePacket,
    workbookPackage.storyWorkbook,
    workbookPackage.qaReport,
    {
      workflowRunId: 'run.test.203',
      styleProfile: 'cinematic-sci-fi',
      timestamp: '2026-04-21T00:01:00Z',
    },
  );
  const renderReview = reviewRenderPrompts(visualPackage.renderPrompts, visualPackage.letteringMaps);

  assert.equal(renderReview.findings.some((/** @type {{ severity: string }} */ finding) => finding.severity === 'blocking'), false);
  assert.equal(
    visualPackage.renderPrompts.every((/** @type {any} */ renderPrompt) => renderPrompt.textLayerPolicy.letteringHandledSeparately),
    true,
  );
  assert.equal(
    visualPackage.renderPrompts.every((/** @type {any} */ renderPrompt) => renderPrompt.textLayerPolicy.renderVisibleText === false),
    true,
  );
  assert.equal(
    visualPackage.letteringMaps.every((/** @type {any} */ letteringMap) => letteringMap.entries.length > 0),
    true,
  );
});
