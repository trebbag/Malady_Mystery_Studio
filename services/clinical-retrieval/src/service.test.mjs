import assert from 'node:assert/strict';
import test from 'node:test';

import { createClinicalRetrievalService } from './service.mjs';

const service = createClinicalRetrievalService();

test('known disease aliases canonicalize predictably', () => {
  const canonicalDisease = service.canonicalizeDiseaseInput('HCC');
  const pulmonaryEmbolism = service.canonicalizeDiseaseInput('PE');

  assert.equal(canonicalDisease.resolutionStatus, 'resolved');
  assert.equal(canonicalDisease.canonicalDiseaseName, 'Hepatocellular carcinoma');
  assert.equal(canonicalDisease.candidateMatches[0].matchType, 'alias');
  assert.equal(pulmonaryEmbolism.resolutionStatus, 'resolved');
  assert.equal(pulmonaryEmbolism.canonicalDiseaseName, 'Pulmonary embolism');
});

test('ambiguous disease input is flagged for review', () => {
  const canonicalDisease = service.canonicalizeDiseaseInput('MG');

  assert.equal(canonicalDisease.resolutionStatus, 'ambiguous');
  assert.equal(canonicalDisease.candidateMatches.length, 2);
});

test('reviewer can confirm an ambiguous candidate', () => {
  const canonicalDisease = service.canonicalizeDiseaseInput('MG');
  const resolved = service.resolveCanonicalization(canonicalDisease, 'Myasthenia gravis');

  assert.equal(resolved.resolutionMode, 'candidate-confirmation');
  assert.equal(resolved.canonicalDisease.resolutionStatus, 'resolved');
  assert.equal(resolved.canonicalDisease.canonicalDiseaseName, 'Myasthenia gravis');
});

test('reviewer override must target an approved disease entry', () => {
  const canonicalDisease = service.canonicalizeDiseaseInput('mystery disease');

  assert.throws(
    () => service.resolveCanonicalization(canonicalDisease, 'not in the seed library'),
    /No approved disease entry matched/,
  );
});

test('researchable but unknown disease input enters the new-disease path', () => {
  const canonicalDisease = service.canonicalizeDiseaseInput('Langerhans cell histiocytosis');

  assert.equal(canonicalDisease.resolutionStatus, 'new-disease');
  assert.equal(canonicalDisease.normalizedInput, 'langerhans cell histiocytosis');
  assert.equal(canonicalDisease.candidateMatches.length, 0);
});

test('vague non-disease input remains unresolved', () => {
  const canonicalDisease = service.canonicalizeDiseaseInput('help me pick something');

  assert.equal(canonicalDisease.resolutionStatus, 'unresolved');
});

test('resolved canonical disease can build a traceable disease packet', () => {
  const canonicalDisease = service.canonicalizeDiseaseInput('community-acquired pneumonia');
  const diseasePacket = service.buildDiseasePacket(canonicalDisease);

  assert.equal(diseasePacket.canonicalDiseaseName, 'Community-acquired pneumonia');
  assert.equal(diseasePacket.evidence.length > 0, true);
  assert.equal(diseasePacket.evidence.every((/** @type {{ claimId: string }} */ record) => typeof record.claimId === 'string'), true);
  assert.equal(typeof diseasePacket.sourceSetHash, 'string');
  assert.equal(diseasePacket.evidenceSummary.sourceIds.length > 0, true);
});

test('agent-compiled knowledge packs normalize into strict disease packet sections', () => {
  const clinicalPackage = service.buildClinicalPackageFromKnowledgePack({
    id: 'kp.loose-agent.001',
    canonicalDiseaseName: 'Loose Agent Syndrome',
    aliases: ['LAS'],
    ontologyId: 'prov:loose-agent-syndrome',
    diseaseCategory: 'agent-compiled disease',
    educationalFocus: ['traceable treatment choices'],
    clinicalSummary: {
      summary: 'Loose agent syndrome is a deliberately messy provisional test disease.',
      mechanism: 'A contract adapter catches loose medical agent output before packet release.',
      timecourse: 'Subacute during local validation.',
      symptoms: ['reviewer uncertainty', 'schema drift'],
    },
    physiologyPrerequisites: [
      {
        title: 'Schema contracts',
        description: 'Readers need contract shape before a story can safely use claims.',
        extra: 'ignored',
      },
    ],
    pathophysiology: [
      {
        title: 'Agent emits useful but loose structure.',
        description: 'The clinical retrieval service converts it into governed packet fields.',
        level: 'cell biology',
        claimIds: ['clm.loose.001'],
        extra: 'ignored',
      },
    ],
    presentation: {
      commonSymptoms: [{ text: 'schema drift fatigue' }],
      commonSigns: [{ name: 'contract rash' }],
      historyClues: [{ description: 'recent agent output' }],
      physicalExamClues: [{ summary: 'missing fields' }],
      complications: [{ risk: 'downstream schema failure' }],
    },
    diagnostics: {
      labs: [
        {
          test: 'Adapter profile',
          rationale: 'Find loose object arrays before rendering.',
          result: 'Strict field mapping succeeds.',
          claimIds: ['clm.loose.001'],
          extra: 'ignored',
        },
      ],
      differentials: [
        {
          name: 'Hard-coded pack dependency',
          overlap: 'Both can make a run appear stable in narrow tests.',
          distinguishingFeature: 'The adapter handles arbitrary agent-compiled disease packs.',
        },
      ],
    },
    management: {
      acuteStabilization: [
        {
          action: 'Pause at review',
          rationale: 'Prevent unchecked downstream generation.',
        },
      ],
      definitiveTherapies: [
        {
          title: 'Normalize the packet',
          mechanism: 'Map loose fields into strict contract fields.',
          indication: 'Use before story generation.',
        },
      ],
      monitoring: [{ summary: 'Watch for missing claim links.' }],
      notes: [{ text: 'Keep the provisional governance state visible.' }],
    },
    evidence: [
      {
        claimId: 'clm.loose.001',
        claimText: 'Loose agent output must be normalized before becoming a disease packet.',
        sourceId: 'src.loose.001',
        sourceType: 'reference',
        sourceLabel: 'Local schema fixture',
        sourceLocator: 'local fixture',
        confidence: 0.8,
      },
    ],
    sourceCatalog: [
      {
        id: 'src.loose.001',
        canonicalDiseaseName: 'Loose Agent Syndrome',
        sourceLabel: 'Local schema fixture',
        sourceType: 'reference',
        sourceTier: 'tier-3',
        defaultApprovalStatus: 'approved',
        owner: 'clinical-governance',
        governanceNotes: ['Local test fixture.'],
        lastReviewedAt: new Date().toISOString(),
      },
    ],
    clinicalTeachingPoints: [
      {
        topic: 'Clinical review gate',
        point: 'Do not let loose clinical claims bypass reviewer approval.',
        claimIds: ['clm.loose.001'],
      },
    ],
    visualAnchors: [
      {
        id: 'Loose anchor 1',
        name: 'Evidence lock',
        scale: 'organ',
        anatomicLocation: 'case board',
        visualDescription: 'Two alien detectives pin a claim card to the board.',
        claimIds: ['clm.loose.001'],
      },
    ],
    evidenceRelationships: [],
  });
  const diseasePacket = clinicalPackage.diseasePacket;

  assert.equal(diseasePacket.clinicalSummary.oneSentence, 'Loose agent syndrome is a deliberately messy provisional test disease.');
  assert.equal(diseasePacket.clinicalSummary.keyMechanism, 'A contract adapter catches loose medical agent output before packet release.');
  assert.equal(diseasePacket.clinicalSummary.timeScale, 'Subacute during local validation.');
  assert.equal(diseasePacket.clinicalSummary.patientExperienceSummary, 'reviewer uncertainty; schema drift');
  assert.deepEqual(diseasePacket.physiologyPrerequisites[0], {
    topic: 'Schema contracts',
    whyItMatters: 'Readers need contract shape before a story can safely use claims.',
  });
  assert.deepEqual(diseasePacket.pathophysiology[0], {
    order: 1,
    event: 'Agent emits useful but loose structure.',
    mechanism: 'The clinical retrieval service converts it into governed packet fields.',
    scale: 'cellular',
    linkedClaimIds: ['clm.loose.001'],
  });
  assert.deepEqual(diseasePacket.management.acuteStabilization, ['Pause at review']);
  assert.equal(diseasePacket.management.definitiveTherapies[0].name, 'Normalize the packet');
  assert.deepEqual(diseasePacket.management.monitoring, ['Watch for missing claim links.']);
  assert.deepEqual(diseasePacket.presentation.commonSymptoms, ['schema drift fatigue']);
  assert.deepEqual(diseasePacket.diagnostics.labs[0], {
    name: 'Adapter profile',
    purpose: 'Find loose object arrays before rendering.',
    expectedFinding: 'Strict field mapping succeeds.',
    claimIds: ['clm.loose.001'],
  });
  assert.deepEqual(diseasePacket.diagnostics.differentials[0], {
    disease: 'Hard-coded pack dependency',
    whyConsidered: 'Both can make a run appear stable in narrow tests.',
    whyLessLikely: 'The adapter handles arbitrary agent-compiled disease packs.',
  });
  assert.deepEqual(clinicalPackage.clinicalTeachingPoints.points[0], {
    order: 1,
    title: 'Clinical review gate',
    teachingPoint: 'Do not let loose clinical claims bypass reviewer approval.',
    linkedClaimIds: ['clm.loose.001'],
  });
  assert.deepEqual(clinicalPackage.visualAnchorCatalog.anchors[0], {
    anchorId: 'Loose-anchor-1',
    title: 'Evidence lock',
    bodyScale: 'organ',
    location: 'case board',
    description: 'Two alien detectives pin a claim card to the board.',
    linkedClaimIds: ['clm.loose.001'],
  });
});

test('evidence registry can retrieve records by claim id', () => {
  const evidenceRecord = service.getEvidenceRecord('clm.dka.005');

  assert.equal(evidenceRecord?.claimId, 'clm.dka.005');
  assert.equal(evidenceRecord?.canonicalDiseaseName, 'Diabetic ketoacidosis');
  assert.equal(typeof evidenceRecord?.sourceId, 'string');
  assert.equal(typeof evidenceRecord?.freshnessScore, 'number');
});

test('source registry returns governed source records', () => {
  const sourceRecords = service.listSourceRecords('Hepatocellular carcinoma');

  assert.equal(sourceRecords.length > 0, true);
  assert.equal(sourceRecords.every((/** @type {{ id: string, freshnessStatus: string }} */ sourceRecord) => (
    typeof sourceRecord.id === 'string' && typeof sourceRecord.freshnessStatus === 'string'
  )), true);
});
