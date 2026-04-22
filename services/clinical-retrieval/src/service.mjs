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

/**
 * @param {string | undefined | null} canonicalDiseaseName
 * @returns {string}
 */
function normalizeCanonicalDiseaseName(canonicalDiseaseName) {
  return typeof canonicalDiseaseName === 'string' ? normalizeDiseaseInput(canonicalDiseaseName) : '';
}

/**
 * @param {string | undefined | null} left
 * @param {string | undefined | null} right
 * @returns {boolean}
 */
function sameCanonicalDisease(left, right) {
  return normalizeCanonicalDiseaseName(left) === normalizeCanonicalDiseaseName(right);
}

/**
 * @param {string} relationshipType
 * @param {string} status
 * @returns {'none' | 'monitor' | 'blocking'}
 */
function toClaimContradictionStatus(relationshipType, status) {
  if (status === 'blocking') {
    return 'blocking';
  }

  if (relationshipType === 'contradicts' && (status === 'open' || status === 'monitor')) {
    return 'monitor';
  }

  return 'none';
}

/**
 * @param {ReadonlyArray<{ contradictionStatus: 'none' | 'monitor' | 'blocking' }>} records
 * @returns {'none' | 'monitor' | 'blocking'}
 */
function maxContradictionStatus(records) {
  if (records.some((record) => record.contradictionStatus === 'blocking')) {
    return 'blocking';
  }

  if (records.some((record) => record.contradictionStatus === 'monitor')) {
    return 'monitor';
  }

  return 'none';
}

/**
 * @param {ReadonlyArray<{ occurredAt?: string }>} records
 * @returns {any | null}
 */
function selectLatestRecord(records) {
  return [...records]
    .filter((record) => typeof record?.occurredAt === 'string')
    .sort((left, right) => String(left.occurredAt).localeCompare(String(right.occurredAt)))
    .at(-1) ?? null;
}

/**
 * @param {any[]} governanceDecisions
 * @param {string} canonicalDiseaseName
 * @returns {Map<string, any>}
 */
function indexGovernanceDecisions(governanceDecisions, canonicalDiseaseName) {
  /** @type {Map<string, any[]>} */
  const groupedDecisions = new Map();

  for (const decision of governanceDecisions) {
    if (typeof decision?.sourceId !== 'string') {
      continue;
    }

    if (
      typeof decision.canonicalDiseaseName === 'string'
      && !sameCanonicalDisease(decision.canonicalDiseaseName, canonicalDiseaseName)
    ) {
      continue;
    }

    const entries = groupedDecisions.get(decision.sourceId) ?? [];
    entries.push(decision);
    groupedDecisions.set(decision.sourceId, entries);
  }

  /** @type {Map<string, any>} */
  const latestDecisions = new Map();

  for (const [sourceId, decisions] of groupedDecisions.entries()) {
    const latestDecision = selectLatestRecord(decisions);

    if (latestDecision) {
      latestDecisions.set(sourceId, latestDecision);
    }
  }

  return latestDecisions;
}

/**
 * @param {any[]} contradictionResolutions
 * @param {string} canonicalDiseaseName
 * @returns {Map<string, any>}
 */
function indexContradictionResolutions(contradictionResolutions, canonicalDiseaseName) {
  /** @type {Map<string, any[]>} */
  const groupedResolutions = new Map();

  for (const resolution of contradictionResolutions) {
    if (typeof resolution?.claimId !== 'string') {
      continue;
    }

    if (
      typeof resolution.canonicalDiseaseName === 'string'
      && !sameCanonicalDisease(resolution.canonicalDiseaseName, canonicalDiseaseName)
    ) {
      continue;
    }

    const relatedKey = typeof resolution.relatedClaimId === 'string'
      ? `${resolution.claimId}::${resolution.relatedClaimId}`
      : resolution.claimId;
    const entries = groupedResolutions.get(relatedKey) ?? [];
    entries.push(resolution);
    groupedResolutions.set(relatedKey, entries);
  }

  /** @type {Map<string, any>} */
  const latestResolutions = new Map();

  for (const [resolutionKey, resolutions] of groupedResolutions.entries()) {
    const latestResolution = selectLatestRecord(resolutions);

    if (latestResolution) {
      latestResolutions.set(resolutionKey, latestResolution);
    }
  }

  return latestResolutions;
}

/**
 * @param {any} knowledgePack
 * @param {Map<string, any>} contradictionResolutionByKey
 * @returns {any[]}
 */
function buildEvidenceRelationships(knowledgePack, contradictionResolutionByKey) {
  return (knowledgePack.evidenceRelationships ?? []).map((/** @type {any} */ relationship, /** @type {number} */ index) => {
    const relationshipKey = `${relationship.fromClaimId}::${relationship.toClaimId}`;
    const reverseRelationshipKey = `${relationship.toClaimId}::${relationship.fromClaimId}`;
    const claimOnlyResolution = contradictionResolutionByKey.get(relationship.fromClaimId)
      ?? contradictionResolutionByKey.get(relationship.toClaimId);
    const resolution = contradictionResolutionByKey.get(relationshipKey)
      ?? contradictionResolutionByKey.get(reverseRelationshipKey)
      ?? claimOnlyResolution
      ?? null;

    return {
      edgeId: `edg.${knowledgePack.id}.${String(index + 1).padStart(3, '0')}`,
      fromClaimId: relationship.fromClaimId,
      toClaimId: relationship.toClaimId,
      relationshipType: relationship.relationshipType,
      status: resolution?.status ?? relationship.status,
      notes: resolution?.reason ?? relationship.notes,
    };
  });
}

/**
 * @param {any} evidenceRecord
 * @param {any[]} evidenceRelationships
 * @returns {'none' | 'monitor' | 'blocking'}
 */
function determineEvidenceContradictionStatus(evidenceRecord, evidenceRelationships) {
  const relatedRelationships = evidenceRelationships.filter((relationship) => (
    relationship.fromClaimId === evidenceRecord.claimId || relationship.toClaimId === evidenceRecord.claimId
  ));
  const contradictionStatuses = relatedRelationships.map((relationship) => ({
    contradictionStatus: toClaimContradictionStatus(relationship.relationshipType, relationship.status),
  }));

  return maxContradictionStatus(contradictionStatuses);
}

/**
 * @param {any} sourceRecord
 * @param {any} evidenceRecord
 * @returns {'supported' | 'review-required' | 'blocked'}
 */
function determineFactRowStatus(sourceRecord, evidenceRecord) {
  if (sourceRecord.approvalStatus === 'suspended' || evidenceRecord.contradictionStatus === 'blocking') {
    return 'blocked';
  }

  if (
    sourceRecord.approvalStatus === 'conditional'
    || sourceRecord.freshnessStatus === 'stale'
    || evidenceRecord.contradictionStatus === 'monitor'
  ) {
    return 'review-required';
  }

  return 'supported';
}

/**
 * @param {any} sourceRecord
 * @param {any} evidenceRecord
 * @returns {boolean}
 */
function evidenceNeedsReview(sourceRecord, evidenceRecord) {
  return determineFactRowStatus(sourceRecord, evidenceRecord) !== 'supported';
}

/**
 * @param {any} management
 * @returns {{ acuteStabilization: string[], definitiveTherapies: any[], monitoring: string[], notes: string[] }}
 */
function normalizeManagement(management = {}) {
  const acuteStabilization = Array.isArray(management.acuteStabilization)
    ? clone(management.acuteStabilization)
    : clone(management.firstLine ?? []);
  const definitiveTherapies = Array.isArray(management.definitiveTherapies) && management.definitiveTherapies.length > 0
    ? clone(management.definitiveTherapies)
    : (Array.isArray(management.escalation)
      ? management.escalation.map((/** @type {string} */ step, /** @type {number} */ index) => ({
        name: `Escalation step ${index + 1}`,
        mechanismOfAction: step,
        whenUsed: 'Use when the clinical picture escalates beyond initial stabilization.',
      }))
      : []);

  return {
    acuteStabilization,
    definitiveTherapies,
    monitoring: clone(management.monitoring ?? []),
    notes: clone(management.notes ?? []),
  };
}

/**
 * @param {any} diagnostics
 * @returns {any}
 */
function normalizeDiagnostics(diagnostics) {
  return {
    ...clone(diagnostics),
    pathology: (diagnostics.pathology ?? []).map((/** @type {any} */ item) => ({
      name: item.name,
      expectedFinding: item.expectedFinding,
      claimIds: clone(item.claimIds ?? []),
    })),
  };
}

export class ClinicalRetrievalService {
  /**
   * @param {{ rootDir?: string }} [options]
   */
  constructor(options = {}) {
    this.library = createSeedDiseaseLibrary(options.rootDir);
    this.ontologyAdapter = createOntologyAdapter(this.library);
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
      (/** @type {any} */ candidate) => normalizeDiseaseInput(candidate.canonicalDiseaseName) === normalizedCanonicalDiseaseName,
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
   * @param {string} canonicalDiseaseName
   * @returns {any}
   */
  getKnowledgePack(canonicalDiseaseName) {
    const lookup = this.ontologyAdapter.findDiseaseByCanonicalName(canonicalDiseaseName);

    if (!lookup) {
      throw new Error(`No disease template is registered for ${canonicalDiseaseName}.`);
    }

    return lookup.diseaseEntry;
  }

  /**
   * @param {any} knowledgePack
   * @param {{ governanceDecisions?: any[], contradictionResolutions?: any[] }} [options]
   * @returns {{ sourceRecords: any[], evidenceRecords: any[], evidenceGraph: any, factTable: any, clinicalTeachingPoints: any, visualAnchorCatalog: any, diseasePacket: any }}
   */
  buildGovernedClinicalArtifacts(knowledgePack, options = {}) {
    const governanceDecisionBySourceId = indexGovernanceDecisions(
      options.governanceDecisions ?? [],
      knowledgePack.canonicalDiseaseName,
    );
    const contradictionResolutionByKey = indexContradictionResolutions(
      options.contradictionResolutions ?? [],
      knowledgePack.canonicalDiseaseName,
    );
    const evidenceRelationships = buildEvidenceRelationships(knowledgePack, contradictionResolutionByKey);

    /** @type {Map<string, any>} */
    const sourceRecordById = new Map();
    /** @type {Map<string, any[]>} */
    const evidenceRecordsBySourceId = new Map();

    const evidenceRecords = knowledgePack.evidence.map((/** @type {any} */ evidenceRecord) => {
      const sourceCatalogEntry = knowledgePack.sourceCatalog.find((/** @type {any} */ sourceEntry) => sourceEntry.id === evidenceRecord.sourceId);

      if (!sourceCatalogEntry) {
        throw new Error(`Source catalog entry ${evidenceRecord.sourceId} is missing from knowledge pack ${knowledgePack.id}.`);
      }

      const contradictionStatus = determineEvidenceContradictionStatus(evidenceRecord, evidenceRelationships);
      let sourceRecord = sourceRecordById.get(sourceCatalogEntry.id);

      if (!sourceRecord) {
        sourceRecord = buildSourceRecord(
          sourceCatalogEntry,
          governanceDecisionBySourceId.get(sourceCatalogEntry.id),
          'none',
        );
        sourceRecordById.set(sourceCatalogEntry.id, sourceRecord);
      }

      const governedEvidenceRecord = {
        claimId: evidenceRecord.claimId,
        claimText: evidenceRecord.claimText,
        canonicalDiseaseName: knowledgePack.canonicalDiseaseName,
        sourceId: evidenceRecord.sourceId,
        sourceType: evidenceRecord.sourceType,
        sourceLabel: evidenceRecord.sourceLabel,
        sourceLocator: evidenceRecord.sourceLocator,
        confidence: evidenceRecord.confidence,
        sourceTier: sourceRecord.sourceTier,
        lastReviewedAt: sourceRecord.lastReviewedAt,
        freshnessScore: sourceRecord.freshnessScore,
        freshnessStatus: sourceRecord.freshnessStatus,
        contradictionStatus,
        approvalStatus: sourceRecord.approvalStatus,
        applicability: evidenceRecord.applicability,
        reviewNotes: clone(sourceRecord.governanceNotes ?? []),
        claimType: evidenceRecord.claimType ?? 'clinical-claim',
        certaintyLevel: evidenceRecord.certaintyLevel ?? 'moderate',
        diseaseStageApplicability: evidenceRecord.diseaseStageApplicability ?? 'general disease course',
        patientSubgroupApplicability: evidenceRecord.patientSubgroupApplicability ?? 'general teaching baseline',
        importanceRank: evidenceRecord.importanceRank ?? 1,
      };

      const sourceEvidenceEntries = evidenceRecordsBySourceId.get(sourceRecord.id) ?? [];
      sourceEvidenceEntries.push(governedEvidenceRecord);
      evidenceRecordsBySourceId.set(sourceRecord.id, sourceEvidenceEntries);

      return governedEvidenceRecord;
    });

    const sourceRecords = [...sourceRecordById.values()].map((sourceRecord) => {
      const relatedEvidenceRecords = evidenceRecordsBySourceId.get(sourceRecord.id) ?? [];
      const contradictionStatus = maxContradictionStatus(relatedEvidenceRecords);

      return buildSourceRecord(
        knowledgePack.sourceCatalog.find((/** @type {any} */ sourceEntry) => sourceEntry.id === sourceRecord.id),
        governanceDecisionBySourceId.get(sourceRecord.id),
        contradictionStatus,
      );
    });

    const factTable = {
      schemaVersion: SCHEMA_VERSION,
      id: createId('ftb'),
      canonicalDiseaseName: knowledgePack.canonicalDiseaseName,
      rows: evidenceRecords.map((/** @type {any} */ evidenceRecord) => {
        const sourceRecord = sourceRecords.find((record) => record.id === evidenceRecord.sourceId);

        return {
          claimId: evidenceRecord.claimId,
          claimText: evidenceRecord.claimText,
          claimType: evidenceRecord.claimType,
          certaintyLevel: evidenceRecord.certaintyLevel,
          importanceRank: evidenceRecord.importanceRank,
          sourceIds: [evidenceRecord.sourceId],
          diseaseStageApplicability: evidenceRecord.diseaseStageApplicability,
          patientSubgroupApplicability: evidenceRecord.patientSubgroupApplicability,
          status: determineFactRowStatus(sourceRecord, evidenceRecord),
        };
      }),
    };

    const evidenceGraph = {
      schemaVersion: SCHEMA_VERSION,
      id: createId('egr'),
      canonicalDiseaseName: knowledgePack.canonicalDiseaseName,
      nodes: evidenceRecords.map((/** @type {any} */ evidenceRecord) => ({
        nodeId: `nod.${evidenceRecord.claimId}`,
        claimId: evidenceRecord.claimId,
        claimText: evidenceRecord.claimText,
        claimType: evidenceRecord.claimType,
        certaintyLevel: evidenceRecord.certaintyLevel,
        sourceIds: [evidenceRecord.sourceId],
      })),
      edges: evidenceRelationships,
    };

    const clinicalTeachingPoints = {
      schemaVersion: SCHEMA_VERSION,
      id: createId('ctp'),
      canonicalDiseaseName: knowledgePack.canonicalDiseaseName,
      points: clone(knowledgePack.clinicalTeachingPoints ?? []),
    };

    const visualAnchorCatalog = {
      schemaVersion: SCHEMA_VERSION,
      id: createId('vac'),
      canonicalDiseaseName: knowledgePack.canonicalDiseaseName,
      anchors: clone(knowledgePack.visualAnchors ?? []),
    };

    const sourceSetHash = createHash('sha256').update(JSON.stringify({
      evidenceRelationships: evidenceGraph.edges.map((edge) => ({
        fromClaimId: edge.fromClaimId,
        relationshipType: edge.relationshipType,
        status: edge.status,
        toClaimId: edge.toClaimId,
      })),
      sources: sourceRecords.map((sourceRecord) => ({
        approvalStatus: sourceRecord.approvalStatus,
        freshnessStatus: sourceRecord.freshnessStatus,
        id: sourceRecord.id,
        lastReviewedAt: sourceRecord.lastReviewedAt,
      })),
    })).digest('hex');
    const freshnessScore = sourceRecords.length === 0
      ? 0
      : sourceRecords.reduce((sum, sourceRecord) => sum + sourceRecord.freshnessScore, 0) / sourceRecords.length;
    const contradictionCount = evidenceRecords.filter((/** @type {any} */ record) => record.contradictionStatus !== 'none').length;
    const blockingContradictions = evidenceRecords.filter((/** @type {any} */ record) => record.contradictionStatus === 'blocking').length;
    const blockedSources = sourceRecords.filter((sourceRecord) => sourceRecord.approvalStatus === 'suspended').length;
    const reviewRequiredEvidence = evidenceRecords.filter((/** @type {any} */ record) => {
      const sourceRecord = sourceRecords.find((sourceEntry) => sourceEntry.id === record.sourceId);
      return sourceRecord ? evidenceNeedsReview(sourceRecord, record) : false;
    }).length;

    const diseasePacket = {
      schemaVersion: SCHEMA_VERSION,
      id: createId('dpk'),
      diseaseInput: {
        rawInput: knowledgePack.canonicalDiseaseName,
        normalizedInput: normalizeDiseaseInput(knowledgePack.canonicalDiseaseName),
        resolutionStatus: 'resolved',
        ontologyId: knowledgePack.ontologyId,
        confidence: 0.99,
      },
      canonicalDiseaseName: knowledgePack.canonicalDiseaseName,
      aliases: clone(knowledgePack.aliases),
      diseaseCategory: knowledgePack.diseaseCategory,
      sourceSetHash,
      evidenceSummary: {
        sourceIds: sourceRecords.map((sourceRecord) => sourceRecord.id),
        freshnessScore: Number(freshnessScore.toFixed(3)),
        freshnessStatus: freshnessScore >= 0.9 ? 'current' : (freshnessScore >= 0.75 ? 'aging' : 'stale'),
        contradictionCount,
        blockingContradictions,
        governanceVerdict: blockedSources > 0 || blockingContradictions > 0
          ? 'blocked'
          : (reviewRequiredEvidence > 0 ? 'review-required' : 'approved'),
      },
      educationalFocus: clone(knowledgePack.educationalFocus),
      clinicalSummary: clone(knowledgePack.clinicalSummary),
      physiologyPrerequisites: clone(knowledgePack.physiologyPrerequisites),
      pathophysiology: clone(knowledgePack.pathophysiology),
      presentation: clone(knowledgePack.presentation),
      diagnostics: normalizeDiagnostics(knowledgePack.diagnostics),
      management: normalizeManagement(knowledgePack.management),
      evidence: evidenceRecords,
    };

    return {
      sourceRecords,
      evidenceRecords,
      evidenceGraph,
      factTable,
      clinicalTeachingPoints,
      visualAnchorCatalog,
      diseasePacket,
    };
  }

  /**
   * @param {string} claimId
   * @param {{ governanceDecisions?: any[], contradictionResolutions?: any[] }} [options]
   * @returns {any | null}
   */
  getEvidenceRecord(claimId, options = {}) {
    const matchingKnowledgePack = Object.values(this.library).find((knowledgePack) => (
      (knowledgePack.evidence ?? []).some((/** @type {any} */ evidenceRecord) => evidenceRecord.claimId === claimId)
    ));

    if (!matchingKnowledgePack) {
      return null;
    }

    return this.buildGovernedClinicalArtifacts(matchingKnowledgePack, options).evidenceRecords.find(
      (evidenceRecord) => evidenceRecord.claimId === claimId,
    ) ?? null;
  }

  /**
   * @param {string} sourceId
   * @param {{ governanceDecisions?: any[], contradictionResolutions?: any[] }} [options]
   * @returns {any | null}
   */
  getSourceRecord(sourceId, options = {}) {
    const matchingKnowledgePack = Object.values(this.library).find((knowledgePack) => (
      (knowledgePack.sourceCatalog ?? []).some((/** @type {any} */ sourceCatalogEntry) => sourceCatalogEntry.id === sourceId)
    ));

    if (!matchingKnowledgePack) {
      return null;
    }

    return this.buildGovernedClinicalArtifacts(matchingKnowledgePack, options).sourceRecords.find(
      (sourceRecord) => sourceRecord.id === sourceId,
    ) ?? null;
  }

  /**
   * @param {string} canonicalDiseaseName
   * @param {{ governanceDecisions?: any[], contradictionResolutions?: any[] }} [options]
   * @returns {any[]}
   */
  listSourceRecords(canonicalDiseaseName, options = {}) {
    return this.buildGovernedClinicalArtifacts(this.getKnowledgePack(canonicalDiseaseName), options).sourceRecords;
  }

  /**
   * @param {string} canonicalDiseaseName
   * @param {{ governanceDecisions?: any[], contradictionResolutions?: any[] }} [options]
   * @returns {any[]}
   */
  listEvidenceRecords(canonicalDiseaseName, options = {}) {
    return this.buildGovernedClinicalArtifacts(this.getKnowledgePack(canonicalDiseaseName), options).evidenceRecords;
  }

  /**
   * @param {string} canonicalDiseaseName
   * @param {{ contradictionResolutions?: any[] }} [options]
   * @returns {any[]}
   */
  listEvidenceRelationships(canonicalDiseaseName, options = {}) {
    const knowledgePack = this.getKnowledgePack(canonicalDiseaseName);
    const contradictionResolutionByKey = indexContradictionResolutions(
      options.contradictionResolutions ?? [],
      canonicalDiseaseName,
    );
    return buildEvidenceRelationships(knowledgePack, contradictionResolutionByKey);
  }

  /**
   * @param {any} canonicalDisease
   * @param {{ governanceDecisions?: any[], contradictionResolutions?: any[] }} [options]
   * @returns {any}
   */
  buildDiseasePacket(canonicalDisease, options = {}) {
    if (canonicalDisease.resolutionStatus !== 'resolved') {
      throw new Error('Disease packet generation requires a resolved canonical disease.');
    }

    return this.buildGovernedClinicalArtifacts(
      this.getKnowledgePack(canonicalDisease.canonicalDiseaseName),
      options,
    ).diseasePacket;
  }

  /**
   * @param {any} canonicalDisease
   * @param {{ governanceDecisions?: any[], contradictionResolutions?: any[] }} [options]
   * @returns {{ diseasePacket: any, factTable: any, evidenceGraph: any, clinicalTeachingPoints: any, visualAnchorCatalog: any, sourceRecords: any[], evidenceRecords: any[] }}
   */
  buildClinicalPackage(canonicalDisease, options = {}) {
    if (canonicalDisease.resolutionStatus !== 'resolved') {
      throw new Error('Clinical package generation requires a resolved canonical disease.');
    }

    return this.buildGovernedClinicalArtifacts(
      this.getKnowledgePack(canonicalDisease.canonicalDiseaseName),
      options,
    );
  }
}

/**
 * @param {{ rootDir?: string }} [options]
 * @returns {ClinicalRetrievalService}
 */
export function createClinicalRetrievalService(options = {}) {
  return new ClinicalRetrievalService(options);
}
