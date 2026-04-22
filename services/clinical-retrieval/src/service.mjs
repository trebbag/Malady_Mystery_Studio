import { createHash } from 'node:crypto';

import { createId } from '../../../packages/shared-config/src/ids.mjs';
import { createSeedDiseaseLibrary } from './disease-library.mjs';
import { createOntologyAdapter, normalizeDiseaseInput } from './ontology-adapter.mjs';
import { buildSourceRecord } from './source-registry.mjs';

const SCHEMA_VERSION = '1.0.0';

/**
 * @template T
 * @param {T} value
 * @returns {T}
 */
function clone(value) {
  return structuredClone(value);
}

export class ClinicalRetrievalService {
  constructor() {
    this.library = createSeedDiseaseLibrary();
    this.ontologyAdapter = createOntologyAdapter(this.library);
    /** @type {Map<string, any>} */
    this.evidenceIndex = new Map();
    /** @type {Map<string, any>} */
    this.sourceIndex = new Map();

    for (const entry of Object.values(this.library)) {
      for (const evidenceRecord of entry.evidence) {
        const sourceRecord = buildSourceRecord({
          canonicalDiseaseName: entry.canonicalDiseaseName,
          sourceLabel: evidenceRecord.sourceLabel,
          sourceType: evidenceRecord.sourceType,
          lastReviewedAt: evidenceRecord.lastReviewedAt,
        });
        const governedEvidenceRecord = {
          ...clone(evidenceRecord),
          canonicalDiseaseName: entry.canonicalDiseaseName,
          sourceId: sourceRecord.id,
          sourceTier: sourceRecord.sourceTier,
          freshnessScore: sourceRecord.freshnessScore,
          freshnessStatus: sourceRecord.freshnessStatus,
          contradictionStatus: sourceRecord.contradictionStatus,
          approvalStatus: sourceRecord.approvalStatus,
          reviewNotes: clone(sourceRecord.governanceNotes ?? []),
        };

        this.sourceIndex.set(sourceRecord.id, sourceRecord);
        this.evidenceIndex.set(evidenceRecord.claimId, governedEvidenceRecord);
      }
    }
  }

  /**
   * @param {string} rawInput
   * @returns {any}
   */
  canonicalizeDiseaseInput(rawInput) {
    const normalizedInput = normalizeDiseaseInput(rawInput);
    const candidateMatches = this.ontologyAdapter.findAmbiguousMatches(normalizedInput);

    if (candidateMatches) {
      return {
        schemaVersion: SCHEMA_VERSION,
        id: createId('can'),
        rawInput,
        normalizedInput,
        resolutionStatus: 'ambiguous',
        confidence: 0.42,
        candidateMatches: clone(candidateMatches),
        notes: 'Input matches more than one plausible medical concept and needs clarification.',
      };
    }

    const lookup = this.ontologyAdapter.findDiseaseByInput(normalizedInput);

    if (!lookup) {
      return {
        schemaVersion: SCHEMA_VERSION,
        id: createId('can'),
        rawInput,
        normalizedInput,
        resolutionStatus: 'unresolved',
        confidence: 0,
        candidateMatches: [],
        notes: 'No supported disease entry matched the intake string.',
      };
    }

    const { diseaseEntry, exactCanonicalMatch } = lookup;

    return {
      schemaVersion: SCHEMA_VERSION,
      id: createId('can'),
      rawInput,
      normalizedInput,
      resolutionStatus: 'resolved',
      confidence: exactCanonicalMatch ? 0.99 : 0.96,
      canonicalDiseaseName: diseaseEntry.canonicalDiseaseName,
      aliases: clone(diseaseEntry.aliases),
      ontologyId: diseaseEntry.ontologyId,
      diseaseCategory: diseaseEntry.diseaseCategory,
      candidateMatches: [
        {
          canonicalDiseaseName: diseaseEntry.canonicalDiseaseName,
          ontologyId: diseaseEntry.ontologyId,
          matchType: exactCanonicalMatch ? 'exact' : 'alias',
        },
      ],
      notes: exactCanonicalMatch ? 'Exact canonical disease match.' : 'Resolved through the alias map.',
    };
  }

  /**
   * @param {string} selectedCanonicalDiseaseName
   * @returns {{ diseaseKey: string, diseaseEntry: any, normalizedSelection: string } | null}
   */
  lookupCanonicalDisease(selectedCanonicalDiseaseName) {
    const lookup = this.ontologyAdapter.findDiseaseByCanonicalName(selectedCanonicalDiseaseName);

    if (!lookup) {
      return null;
    }

    return {
      diseaseKey: lookup.diseaseKey,
      diseaseEntry: lookup.diseaseEntry,
      normalizedSelection: lookup.normalizedInput,
    };
  }

  /**
   * @param {any} canonicalDisease
   * @param {string} selectedCanonicalDiseaseName
   * @returns {{ canonicalDisease: any, resolutionMode: string }}
   */
  resolveCanonicalization(canonicalDisease, selectedCanonicalDiseaseName) {
    if (!canonicalDisease || canonicalDisease.resolutionStatus === 'resolved') {
      throw new Error('Only ambiguous or unresolved canonical disease artifacts can be reviewer-resolved.');
    }

    const lookup = this.lookupCanonicalDisease(selectedCanonicalDiseaseName);

    if (!lookup) {
      throw new Error(`No approved disease entry matched "${selectedCanonicalDiseaseName}".`);
    }

    const normalizedCanonicalDiseaseName = normalizeDiseaseInput(lookup.diseaseEntry.canonicalDiseaseName);
    const matchedCandidate = canonicalDisease.candidateMatches.find(
      (/** @type {{ canonicalDiseaseName: string }} */ candidate) => (
        normalizeDiseaseInput(candidate.canonicalDiseaseName) === normalizedCanonicalDiseaseName
      ),
    );
    const selectionIsCanonicalName = lookup.normalizedSelection === normalizedCanonicalDiseaseName;
    const resolutionMode = matchedCandidate ? 'candidate-confirmation' : 'reviewer-override';
    const matchType = matchedCandidate ? 'ambiguous-suggestion' : (selectionIsCanonicalName ? 'exact' : 'alias');

    return {
      resolutionMode,
      canonicalDisease: {
        schemaVersion: SCHEMA_VERSION,
        id: createId('can'),
        rawInput: canonicalDisease.rawInput,
        normalizedInput: canonicalDisease.normalizedInput,
        resolutionStatus: 'resolved',
        confidence: matchedCandidate ? 0.9 : 0.82,
        canonicalDiseaseName: lookup.diseaseEntry.canonicalDiseaseName,
        aliases: clone(lookup.diseaseEntry.aliases),
        ontologyId: lookup.diseaseEntry.ontologyId,
        diseaseCategory: lookup.diseaseEntry.diseaseCategory,
        candidateMatches: [
          {
            canonicalDiseaseName: lookup.diseaseEntry.canonicalDiseaseName,
            ontologyId: lookup.diseaseEntry.ontologyId,
            matchType,
          },
        ],
        notes: matchedCandidate
          ? 'Resolved after reviewer confirmation of an ambiguous candidate.'
          : 'Resolved by reviewer override to a supported disease entry.',
      },
    };
  }

  /**
   * @param {string} claimId
   * @returns {any | null}
   */
  getEvidenceRecord(claimId) {
    const record = this.evidenceIndex.get(claimId);
    return record ? clone(record) : null;
  }

  /**
   * @param {string} sourceId
   * @returns {any | null}
   */
  getSourceRecord(sourceId) {
    const sourceRecord = this.sourceIndex.get(sourceId);
    return sourceRecord ? clone(sourceRecord) : null;
  }

  /**
   * @param {string} canonicalDiseaseName
   * @returns {any[]}
   */
  listSourceRecords(canonicalDiseaseName) {
    const evidenceRecords = this.listEvidenceRecords(canonicalDiseaseName);
    const sourceIds = [...new Set(evidenceRecords.map((evidenceRecord) => evidenceRecord.sourceId))];
    return sourceIds
      .map((sourceId) => this.getSourceRecord(sourceId))
      .filter(Boolean);
  }

  /**
   * @param {string} canonicalDiseaseName
   * @returns {any[]}
   */
  listEvidenceRecords(canonicalDiseaseName) {
    const diseaseEntry = Object.values(this.library).find((entry) => entry.canonicalDiseaseName === canonicalDiseaseName);
    if (!diseaseEntry) {
      return [];
    }

    return diseaseEntry.evidence
      .map((/** @type {{ claimId: string }} */ evidenceRecord) => this.getEvidenceRecord(evidenceRecord.claimId))
      .filter((/** @type {any} */ evidenceRecord) => Boolean(evidenceRecord));
  }

  /**
   * @param {any} canonicalDisease
   * @returns {any}
   */
  buildDiseasePacket(canonicalDisease) {
    if (canonicalDisease.resolutionStatus !== 'resolved') {
      throw new Error('Disease packet generation requires a resolved canonical disease.');
    }

    const lookup = this.ontologyAdapter.findDiseaseByCanonicalName(canonicalDisease.canonicalDiseaseName);

    if (!lookup) {
      throw new Error(`No disease template is registered for ${canonicalDisease.canonicalDiseaseName}.`);
    }

    const template = lookup.diseaseEntry;

    const evidence = this.listEvidenceRecords(template.canonicalDiseaseName);
    const sourceIds = [...new Set(evidence.map((evidenceRecord) => evidenceRecord.sourceId))];
    const freshnessScore = evidence.length === 0
      ? 0
      : evidence.reduce((sum, evidenceRecord) => sum + evidenceRecord.freshnessScore, 0) / evidence.length;
    const contradictionCount = evidence.filter((evidenceRecord) => evidenceRecord.contradictionStatus !== 'none').length;
    const blockingContradictions = evidence.filter((evidenceRecord) => evidenceRecord.contradictionStatus === 'blocking').length;
    const needsGovernanceReview = evidence.some((evidenceRecord) => (
      evidenceRecord.approvalStatus !== 'approved'
      || evidenceRecord.freshnessStatus === 'stale'
      || evidenceRecord.contradictionStatus === 'monitor'
    ));
    const sourceSetHash = createHash('sha256').update(
      JSON.stringify(sourceIds.map((sourceId) => this.getSourceRecord(sourceId)?.lastReviewedAt ?? null)),
    ).digest('hex');

    return {
      schemaVersion: SCHEMA_VERSION,
      id: createId('dpk'),
      diseaseInput: {
        rawInput: canonicalDisease.rawInput,
        normalizedInput: canonicalDisease.normalizedInput,
        resolutionStatus: canonicalDisease.resolutionStatus,
        ontologyId: template.ontologyId,
        confidence: canonicalDisease.confidence,
      },
      canonicalDiseaseName: template.canonicalDiseaseName,
      aliases: clone(template.aliases),
      diseaseCategory: template.diseaseCategory,
      sourceSetHash,
      evidenceSummary: {
        sourceIds,
        freshnessScore: Number(freshnessScore.toFixed(3)),
        freshnessStatus: freshnessScore >= 0.9 ? 'current' : (freshnessScore >= 0.75 ? 'aging' : 'stale'),
        contradictionCount,
        blockingContradictions,
        governanceVerdict: blockingContradictions > 0 ? 'blocked' : (needsGovernanceReview ? 'review-required' : 'approved'),
      },
      educationalFocus: clone(template.educationalFocus),
      clinicalSummary: clone(template.clinicalSummary),
      physiologyPrerequisites: clone(template.physiologyPrerequisites),
      pathophysiology: clone(template.pathophysiology),
      presentation: clone(template.presentation),
      diagnostics: clone(template.diagnostics),
      management: clone(template.management),
      evidence,
    };
  }
}

export function createClinicalRetrievalService() {
  return new ClinicalRetrievalService();
}
