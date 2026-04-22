import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildEvidenceTraceabilitySummary,
  deriveEvalStatus,
  isCaseApplicable,
  loadEvaluationCases,
  loadEvalRegistry,
  loadEvalThresholds,
} from './eval-service.mjs';

test('eval registry, thresholds, and datasets load from the local pack', () => {
  const registry = loadEvalRegistry();
  const thresholds = loadEvalThresholds();
  const casesByFamily = loadEvaluationCases(undefined, registry);

  assert.equal(Array.isArray(registry.datasets), true);
  assert.equal(typeof thresholds.medical_accuracy.minimum, 'number');
  assert.equal(typeof thresholds.evidence_traceability.minimum, 'number');
  assert.equal(casesByFamily.medical_accuracy.length > 0, true);
  assert.equal(casesByFamily.evidence_traceability.length > 0, true);
  assert.equal(casesByFamily.governance_release.length > 0, true);
});

test('applicability filtering matches disease-specific and global cases', () => {
  const matchingCase = {
    evalFamily: 'medical_accuracy',
    input: {
      disease: 'community-acquired pneumonia',
      artifact: 'disease-packet',
    },
  };
  const globalCase = {
    evalFamily: 'governance_release',
    input: {
      artifact: 'release-bundle',
    },
  };
  const nonMatchingCase = {
    evalFamily: 'medical_accuracy',
    input: {
      disease: 'myasthenia gravis',
      artifact: 'story-workbook',
    },
  };
  const context = {
    canonicalDiseaseName: 'community-acquired pneumonia',
  };

  assert.equal(isCaseApplicable(matchingCase, context), true);
  assert.equal(isCaseApplicable(globalCase, context), true);
  assert.equal(isCaseApplicable(nonMatchingCase, context), false);
});

test('stale eval detection trips when a newer relevant artifact exists', () => {
  const workflowRun = {
    updatedAt: '2026-04-22T00:04:00Z',
    artifacts: [
      {
        artifactType: 'story-workbook',
        artifactId: 'swb.demo.001',
      },
      {
        artifactType: 'eval-run',
        artifactId: 'evr.demo.001',
      },
    ],
  };
  const fakeStore = {
    getArtifactMetadata(
      /** @type {string} */ artifactType,
      /** @type {string} */ artifactId,
    ) {
      if (artifactType === 'story-workbook' && artifactId === 'swb.demo.001') {
        return {
          createdAt: '2026-04-22T00:05:00Z',
        };
      }

      return null;
    },
  };
  const evalRun = {
    evaluatedAt: '2026-04-22T00:04:30Z',
    summary: {
      allThresholdsMet: true,
    },
  };

  assert.equal(deriveEvalStatus(evalRun, fakeStore, workflowRun), 'stale');
});

test('traceability summary fails when downstream artifacts lose claim links', () => {
  const summary = buildEvidenceTraceabilitySummary({
    diseasePacket: {
      evidenceSummary: {
        blockingContradictions: 0,
      },
      evidence: [
        {
          claimId: 'clm.demo.001',
          sourceId: 'src.demo.001',
          approvalStatus: 'approved',
          freshnessStatus: 'current',
        },
      ],
    },
    storyWorkbook: {
      clueLadder: [
        {
          linkedClaimIds: ['clm.demo.001'],
        },
      ],
    },
    sceneCards: [],
    panelPlans: [
      {
        panels: [
          {
            linkedClaimIds: [],
          },
        ],
      },
    ],
    renderPrompts: [
      {
        linkedClaimIds: [],
      },
    ],
    letteringMaps: [
      {
        entries: [
          {
            linkedClaimIds: [],
          },
        ],
      },
    ],
  });

  assert.equal(summary.verdict, 'failed');
  assert.equal(summary.score < 0.95, true);
  assert.equal(summary.blockers.some((blocker) => blocker.includes('missing valid linked claim ids')), true);
});
