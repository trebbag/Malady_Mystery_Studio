import assert from 'node:assert/strict';
import test from 'node:test';

import { createExporterService, buildSourceEvidencePack, renderReleaseBundleIndex } from './service.mjs';

function createApprovedRun() {
  return {
    id: 'run.demo.001',
    tenantId: 'tenant.demo',
    state: 'approved',
    requiredApprovalRoles: ['clinical', 'editorial', 'product'],
    approvals: [
      {
        role: 'clinical',
        reviewerId: 'usr.clinical.001',
        decision: 'approved',
        timestamp: '2026-04-21T00:00:00Z',
      },
      {
        role: 'editorial',
        reviewerId: 'usr.story.001',
        decision: 'approved',
        timestamp: '2026-04-21T00:01:00Z',
      },
      {
        role: 'product',
        reviewerId: 'usr.product.001',
        decision: 'approved',
        timestamp: '2026-04-21T00:02:00Z',
      },
    ],
  };
}

/**
 * @param {string} subjectType
 * @param {string} [verdict]
 * @returns {any}
 */
function createQaReport(subjectType, verdict = 'pass') {
  return {
    id: `qa.${subjectType}`,
    subjectType,
    verdict,
    scores: {
      medicalAccuracy: 0.96,
      mysteryIntegrity: 0.91,
      educationalSequencing: 0.93,
      panelization: 0.9,
      renderReadiness: 0.92,
    },
    blockingIssues: verdict === 'fail' ? ['blocking issue'] : [],
    warnings: [],
    reviewers: [],
  };
}

function createDiseasePacket() {
  return {
    id: 'dpk.demo.001',
    canonicalDiseaseName: 'Pulmonary embolism',
    sourceSetHash: 'srcset.demo.001',
    evidenceSummary: {
      sourceIds: ['src.demo.guideline'],
      freshnessScore: 0.97,
      freshnessStatus: 'current',
      contradictionCount: 0,
      blockingContradictions: 0,
      governanceVerdict: 'approved',
    },
    evidence: [
      {
        claimId: 'clm.pe.001',
        sourceId: 'src.demo.guideline',
        sourceLabel: 'Approved thromboembolism guideline',
        sourceType: 'guideline',
        sourceLocator: 'diagnostic strategy',
        freshnessStatus: 'current',
        contradictionStatus: 'none',
        approvalStatus: 'approved',
      },
    ],
  };
}

function createEvaluationSummary() {
  return {
    evalRunId: 'evr.demo.001',
    evaluatedAt: '2026-04-21T00:03:00Z',
    allThresholdsMet: true,
    applicableFamilyCount: 8,
    passedFamilyCount: 8,
    failedFamilyCount: 0,
    familyScores: {
      medical_accuracy: 1,
      evidence_traceability: 1,
      mystery_integrity: 1,
      educational_sequencing: 1,
      panelization: 1,
      render_readiness: 1,
      rendering_guide_quality: 1,
      render_output_quality: 1,
      governance_release: 1,
    },
  };
}

test('exporter assembles a release bundle from an approved run', () => {
  const exporter = createExporterService();
  const artifactManifest = [
    'disease-packet',
    'story-workbook',
    'scene-card',
    'panel-plan',
    'render-prompt',
    'rendering-guide',
    'lettering-map',
    'qa-report',
  ].map((artifactType, index) => ({
    artifactType,
    artifactId: `${artifactType}.${index}`,
    location: `tenant.demo/${artifactType}/${index}.json`,
    checksum: `checksum-${index}`,
    contentType: 'application/json',
    retentionClass: 'approved-artifact',
  }));

  const assembled = exporter.assembleRelease({
    workflowRun: createApprovedRun(),
    project: {
      title: 'Pulmonary embolism starter project',
    },
    actor: {
      id: 'usr.owner.001',
    },
    diseasePacket: createDiseasePacket(),
    qaReports: [createQaReport('workflow-run')],
    artifactManifest,
    evaluationSummary: createEvaluationSummary(),
  });

  assert.equal(assembled.releaseBundle.workflowRunId, 'run.demo.001');
  assert.equal(assembled.releaseBundle.qualitySummary.releaseVerdict, 'approved');
  assert.equal(
    assembled.releaseBundle.releaseGateChecks.every((/** @type {{ status: string }} */ gateCheck) => gateCheck.status === 'passed'),
    true,
  );
  assert.equal(assembled.exportHistoryEntry.status, 'completed');
});

test('exporter blocks release when required artifacts are missing', () => {
  const exporter = createExporterService();

  assert.throws(
    () => exporter.assembleRelease({
      workflowRun: createApprovedRun(),
      project: {
        title: 'Pulmonary embolism starter project',
      },
      actor: {
        id: 'usr.owner.001',
      },
      diseasePacket: createDiseasePacket(),
      qaReports: [createQaReport('workflow-run')],
      evaluationSummary: createEvaluationSummary(),
      artifactManifest: [
        {
          artifactType: 'disease-packet',
          artifactId: 'dpk.demo.001',
          location: 'tenant.demo/disease-packet/dpk.demo.001.json',
          checksum: 'checksum',
          contentType: 'application/json',
          retentionClass: 'approved-artifact',
        },
      ],
    }),
    /artifact-completeness/,
  );
});

test('exporter no longer requires rendered output when a rendering guide is present', () => {
  const exporter = createExporterService();
  const artifactManifest = [
    'disease-packet',
    'story-workbook',
    'scene-card',
    'panel-plan',
    'render-prompt',
    'rendering-guide',
    'lettering-map',
    'qa-report',
  ].map((artifactType, index) => ({
    artifactType,
    artifactId: `${artifactType}.${index}`,
    location: `tenant.demo/${artifactType}/${index}.json`,
    checksum: `checksum-${index}`,
    contentType: 'application/json',
    retentionClass: 'approved-artifact',
  }));

  const assembled = exporter.assembleRelease({
    workflowRun: createApprovedRun(),
    project: {
      title: 'Pulmonary embolism starter project',
    },
    actor: {
      id: 'usr.owner.001',
    },
    diseasePacket: createDiseasePacket(),
    qaReports: [createQaReport('workflow-run')],
    artifactManifest,
    evaluationSummary: createEvaluationSummary(),
  });
  /** @type {any[]} */
  const releaseGateChecks = assembled.releaseBundle.releaseGateChecks;

  assert.equal(assembled.releaseBundle.renderedAssetManifestId ?? null, null);
  assert.equal(
    releaseGateChecks.some((gateCheck) => gateCheck.name === 'rendered-output-manual'),
    false,
  );
  assert.equal(
    releaseGateChecks.some((gateCheck) => gateCheck.name === 'rendering-guide' && gateCheck.status === 'passed'),
    true,
  );
});

test('bundle index and evidence pack remain human-readable', () => {
  const releaseBundle = {
    releaseId: 'rel.demo.001',
    workflowRunId: 'run.demo.001',
    tenantId: 'tenant.demo',
    exportedBy: 'usr.owner.001',
    exportedAt: '2026-04-21T00:00:00Z',
    qualitySummary: {
      releaseVerdict: 'approved',
    },
    releaseGateChecks: [
      {
        name: 'required-approvals',
        status: 'passed',
        details: 'All approvals present.',
      },
    ],
    artifactManifest: [
      {
        artifactType: 'story-workbook',
        artifactId: 'swb.demo.001',
        location: 'tenant.demo/story-workbook/swb.demo.001.json',
      },
    ],
    approvals: [
      {
        role: 'clinical',
        reviewerId: 'usr.clinical.001',
        decision: 'approved',
      },
    ],
  };
  const bundleIndex = renderReleaseBundleIndex(releaseBundle, { id: 'run.demo.001' }, 'Pulmonary embolism starter project');
  const evidencePack = buildSourceEvidencePack(createDiseasePacket());

  assert.match(bundleIndex, /Release Bundle rel\.demo\.001/);
  assert.equal(evidencePack.evidence[0].sourceId, 'src.demo.guideline');
});
