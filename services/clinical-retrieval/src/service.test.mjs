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

test('resolved canonical disease can build a traceable disease packet', () => {
  const canonicalDisease = service.canonicalizeDiseaseInput('community-acquired pneumonia');
  const diseasePacket = service.buildDiseasePacket(canonicalDisease);

  assert.equal(diseasePacket.canonicalDiseaseName, 'Community-acquired pneumonia');
  assert.equal(diseasePacket.evidence.length > 0, true);
  assert.equal(diseasePacket.evidence.every((/** @type {{ claimId: string }} */ record) => typeof record.claimId === 'string'), true);
  assert.equal(typeof diseasePacket.sourceSetHash, 'string');
  assert.equal(diseasePacket.evidenceSummary.sourceIds.length > 0, true);
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
