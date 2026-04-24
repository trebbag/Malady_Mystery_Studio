import { createHash } from 'node:crypto';

import { createId } from '../../../packages/shared-config/src/ids.mjs';
import { createSeedDiseaseLibrary } from './disease-library.mjs';
import { createOntologyAdapter, normalizeDiseaseInput } from './ontology-adapter.mjs';
import { buildSourceRecord } from './source-registry.mjs';

const SCHEMA_VERSION = '1.0.0';
const SAFE_ID_PATTERN = /^[A-Za-z0-9._:-]+$/u;

/**
 * @template T
 * @param {T} value
 * @returns {T}
 */
function clone(value) {
  return structuredClone(value);
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * @param {unknown} value
 * @param {string} fallback
 * @returns {string}
 */
function toText(value, fallback) {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (Array.isArray(value)) {
    const joined = value
      .map((item) => toText(item, ''))
      .filter(Boolean)
      .join('; ');
    return joined || fallback;
  }

  if (isRecord(value)) {
    const preferredKeys = ['text', 'summary', 'description', 'name', 'title', 'action', 'rationale'];
    const preferredValue = preferredKeys
      .map((key) => value[key])
      .find((item) => typeof item === 'string' && item.trim());

    if (typeof preferredValue === 'string') {
      return preferredValue.trim();
    }

    const flattened = Object.entries(value)
      .filter(([, entryValue]) => typeof entryValue === 'string' && entryValue.trim())
      .map(([key, entryValue]) => `${key}: ${entryValue}`)
      .join('; ');
    return flattened || fallback;
  }

  return fallback;
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function toTextArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => toText(item, `Item ${index + 1}`))
    .filter(Boolean);
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function toSafeIdArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item) => typeof item === 'string' && SAFE_ID_PATTERN.test(item));
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

const VAGUE_DISEASE_INPUTS = new Set([
  '',
  'condition',
  'disease',
  'illness',
  'medical-problem',
  'mystery-disease',
  'problem',
  'syndrome',
  'unknown',
]);
const NON_DISEASE_INPUT_TOKENS = new Set([
  'anything',
  'choose',
  'help',
  'pick',
  'please',
  'something',
]);

/**
 * @param {string} rawInput
 * @returns {boolean}
 */
function isResearchableDiseaseInput(rawInput) {
  const normalizedInput = normalizeDiseaseInput(rawInput);

  if (!normalizedInput || normalizedInput.length < 4) {
    return false;
  }

  if (VAGUE_DISEASE_INPUTS.has(normalizedInput)) {
    return false;
  }

  if (normalizedInput.split(' ').some((token) => NON_DISEASE_INPUT_TOKENS.has(token))) {
    return false;
  }

  return /[a-z]/i.test(rawInput);
}

/**
 * @param {string} rawInput
 * @returns {string}
 */
function toCanonicalDiseaseLabel(rawInput) {
  return rawInput
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((token) => token ? `${token[0].toUpperCase()}${token.slice(1)}` : token)
    .join(' ');
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
 * @param {any} presentation
 * @param {{ timeScale?: string }} [clinicalSummary]
 * @returns {{ commonSymptoms: string[], commonSigns: string[], historyClues: string[], physicalExamClues: string[], complications: string[], typicalTimecourse?: string }}
 */
function normalizePresentation(presentation = {}, clinicalSummary = {}) {
  const commonSymptoms = Array.isArray(presentation.commonSymptoms)
    ? toTextArray(presentation.commonSymptoms)
    : toTextArray(presentation.hallmarkSymptoms ?? []);
  const commonSigns = Array.isArray(presentation.commonSigns)
    ? toTextArray(presentation.commonSigns)
    : toTextArray(presentation.hallmarkSigns ?? presentation.signs ?? []);
  const historyClues = Array.isArray(presentation.historyClues)
    ? toTextArray(presentation.historyClues)
    : toTextArray(presentation.history ?? presentation.hallmarkSymptoms ?? []);
  const physicalExamClues = Array.isArray(presentation.physicalExamClues)
    ? toTextArray(presentation.physicalExamClues)
    : toTextArray(presentation.examFindings ?? commonSigns);
  const complications = Array.isArray(presentation.complications)
    ? toTextArray(presentation.complications)
    : toTextArray(presentation.redFlags ?? []);
  const typicalTimecourse = typeof presentation.typicalTimecourse === 'string'
    ? presentation.typicalTimecourse
    : (typeof presentation.timecourse === 'string' ? presentation.timecourse : clinicalSummary.timeScale);

  return {
    commonSymptoms,
    commonSigns,
    historyClues,
    physicalExamClues,
    complications,
    ...(typeof typicalTimecourse === 'string' && typicalTimecourse ? { typicalTimecourse } : {}),
  };
}

/**
 * @param {any} clinicalSummary
 * @param {string} canonicalDiseaseName
 * @returns {{ oneSentence: string, keyMechanism: string, timeScale: string, patientExperienceSummary: string }}
 */
function normalizeClinicalSummary(clinicalSummary = {}, canonicalDiseaseName) {
  const summary = isRecord(clinicalSummary) ? clinicalSummary : {};

  return {
    oneSentence: toText(
      summary.oneSentence ?? summary.summary ?? summary.definition ?? summary.overview,
      `${canonicalDiseaseName} is a reviewer-gated disease topic compiled from the run's governed evidence package.`,
    ),
    keyMechanism: toText(
      summary.keyMechanism ?? summary.mechanism ?? summary.pathophysiology ?? summary.coreMechanism,
      `The key mechanism for ${canonicalDiseaseName} must remain tied to approved evidence claims before release.`,
    ),
    timeScale: toText(
      summary.timeScale ?? summary.timecourse ?? summary.temporalPattern,
      'Variable clinical time scale; confirm disease-specific timing during clinical review.',
    ),
    patientExperienceSummary: toText(
      summary.patientExperienceSummary ?? summary.patientExperience ?? summary.symptoms ?? summary.presentation,
      `A learner-facing patient experience summary for ${canonicalDiseaseName} must be reviewed against the evidence packet.`,
    ),
  };
}

/**
 * @param {any[]} physiologyPrerequisites
 * @param {string} canonicalDiseaseName
 * @returns {{ topic: string, whyItMatters: string }[]}
 */
function normalizePhysiologyPrerequisites(physiologyPrerequisites = [], canonicalDiseaseName) {
  const normalized = /** @type {{ topic: string, whyItMatters: string }[]} */ ((Array.isArray(physiologyPrerequisites) ? physiologyPrerequisites : [])
    .map((item, index) => {
      if (typeof item === 'string') {
        return {
          topic: item,
          whyItMatters: `This prerequisite helps learners follow the ${canonicalDiseaseName} mechanism in the story.`,
        };
      }

      if (isRecord(item)) {
        return {
          topic: toText(item.topic ?? item.name ?? item.title, `Prerequisite ${index + 1}`),
          whyItMatters: toText(
            item.whyItMatters ?? item.rationale ?? item.description ?? item.summary,
            `This prerequisite helps learners follow the ${canonicalDiseaseName} mechanism in the story.`,
          ),
        };
      }

      return null;
    })
    .filter(Boolean));

  return normalized.length > 0
    ? normalized
    : [
      {
        topic: `${canonicalDiseaseName} core physiology`,
        whyItMatters: 'The story and visual sequence need a reviewed physiology baseline before mechanism clues are staged.',
      },
    ];
}

/**
 * @param {unknown} scale
 * @returns {'whole-body' | 'organ' | 'tissue' | 'cellular' | 'molecular'}
 */
function normalizeMechanismScale(scale) {
  const value = typeof scale === 'string' ? scale.toLowerCase() : '';

  if (value.includes('molecular')) {
    return 'molecular';
  }

  if (value.includes('cell')) {
    return 'cellular';
  }

  if (value.includes('tissue')) {
    return 'tissue';
  }

  if (value.includes('organ')) {
    return 'organ';
  }

  if (value.includes('body') || value.includes('system')) {
    return 'whole-body';
  }

  return 'organ';
}

/**
 * @param {any[]} pathophysiology
 * @param {{ keyMechanism: string }} clinicalSummary
 * @param {{ claimId: string }[]} evidence
 * @param {string} canonicalDiseaseName
 * @returns {{ order: number, event: string, mechanism: string, scale: 'whole-body' | 'organ' | 'tissue' | 'cellular' | 'molecular', linkedClaimIds?: string[] }[]}
 */
function normalizePathophysiology(pathophysiology = [], clinicalSummary, evidence, canonicalDiseaseName) {
  const validClaimIds = new Set((Array.isArray(evidence) ? evidence : []).map((record) => record.claimId));
  const fallbackClaimIds = [...validClaimIds].slice(0, 2);
  const normalized = /** @type {{ order: number, event: string, mechanism: string, scale: 'whole-body' | 'organ' | 'tissue' | 'cellular' | 'molecular', linkedClaimIds?: string[] }[]} */ ((Array.isArray(pathophysiology) ? pathophysiology : [])
    .map((item, index) => {
      if (typeof item === 'string') {
        return {
          order: index + 1,
          event: item,
          mechanism: clinicalSummary.keyMechanism,
          scale: /** @type {'organ'} */ ('organ'),
          ...(fallbackClaimIds.length > 0 ? { linkedClaimIds: fallbackClaimIds } : {}),
        };
      }

      if (!isRecord(item)) {
        return null;
      }

      const candidateClaimIds = item.linkedClaimIds ?? item.claimIds;
      const linkedClaimIds = Array.isArray(candidateClaimIds)
        ? candidateClaimIds.filter((/** @type {unknown} */ claimId) => typeof claimId === 'string' && validClaimIds.has(claimId))
        : fallbackClaimIds;
      const orderValue = Number(item.order);

      return {
        order: Number.isInteger(orderValue) && orderValue > 0 ? orderValue : index + 1,
        event: toText(item.event ?? item.step ?? item.title ?? item.name, `Mechanism step ${index + 1}`),
        mechanism: toText(
          item.mechanism ?? item.description ?? item.explanation ?? item.process,
          clinicalSummary.keyMechanism,
        ),
        scale: normalizeMechanismScale(item.scale ?? item.level),
        ...(linkedClaimIds.length > 0 ? { linkedClaimIds } : {}),
      };
    })
    .filter(Boolean));

  return normalized.length > 0
    ? normalized
    : [
      {
        order: 1,
        event: `${canonicalDiseaseName} mechanism checkpoint`,
        mechanism: clinicalSummary.keyMechanism,
        scale: 'organ',
        ...(fallbackClaimIds.length > 0 ? { linkedClaimIds: fallbackClaimIds } : {}),
      },
    ];
}

/**
 * @param {unknown} value
 * @param {Set<string>} validClaimIds
 * @param {string[]} fallbackClaimIds
 * @returns {string[]}
 */
function normalizeLinkedClaimIds(value, validClaimIds, fallbackClaimIds) {
  const claimIds = Array.isArray(value)
    ? value.filter((claimId) => typeof claimId === 'string' && validClaimIds.has(claimId))
    : [];

  return claimIds.length > 0 ? claimIds : fallbackClaimIds;
}

/**
 * @param {string} prefix
 * @param {unknown} value
 * @param {number} index
 * @returns {string}
 */
function normalizeArtifactScopedId(prefix, value, index) {
  const raw = typeof value === 'string' && value.trim()
    ? value.trim()
    : `${prefix}.${String(index + 1).padStart(3, '0')}`;
  const safe = raw.replace(/[^A-Za-z0-9._:-]+/gu, '-').replace(/^-+|-+$/gu, '');
  return safe || `${prefix}.${String(index + 1).padStart(3, '0')}`;
}

/**
 * @param {any[]} teachingPoints
 * @param {{ claimId: string }[]} evidence
 * @param {string} canonicalDiseaseName
 * @returns {{ order: number, title: string, teachingPoint: string, linkedClaimIds: string[] }[]}
 */
function normalizeClinicalTeachingPoints(teachingPoints = [], evidence, canonicalDiseaseName) {
  const validClaimIds = new Set((Array.isArray(evidence) ? evidence : []).map((record) => record.claimId));
  const fallbackClaimIds = [...validClaimIds].slice(0, 2);
  const normalized = /** @type {{ order: number, title: string, teachingPoint: string, linkedClaimIds: string[] }[]} */ ((Array.isArray(teachingPoints) ? teachingPoints : [])
    .map((item, index) => {
      if (typeof item === 'string') {
        return {
          order: index + 1,
          title: `Teaching point ${index + 1}`,
          teachingPoint: item,
          linkedClaimIds: fallbackClaimIds,
        };
      }

      if (!isRecord(item)) {
        return null;
      }

      const orderValue = Number(item.order);

      return {
        order: Number.isInteger(orderValue) && orderValue > 0 ? orderValue : index + 1,
        title: toText(item.title ?? item.name ?? item.topic, `Teaching point ${index + 1}`),
        teachingPoint: toText(
          item.teachingPoint ?? item.point ?? item.description ?? item.explanation,
          `Review how ${canonicalDiseaseName} should be taught in the story.`,
        ),
        linkedClaimIds: normalizeLinkedClaimIds(item.linkedClaimIds ?? item.claimIds, validClaimIds, fallbackClaimIds),
      };
    })
    .filter((item) => item && item.linkedClaimIds.length > 0));

  return normalized.length > 0
    ? normalized
    : [
      {
        order: 1,
        title: `${canonicalDiseaseName} evidence checkpoint`,
        teachingPoint: 'Reviewer should confirm the most important teachable clinical claims before release.',
        linkedClaimIds: fallbackClaimIds.length > 0 ? fallbackClaimIds : ['clm.placeholder'],
      },
    ];
}

/**
 * @param {any[]} visualAnchors
 * @param {{ claimId: string }[]} evidence
 * @param {string} canonicalDiseaseName
 * @returns {{ anchorId: string, title: string, bodyScale: string, location: string, description: string, linkedClaimIds: string[] }[]}
 */
function normalizeVisualAnchors(visualAnchors = [], evidence, canonicalDiseaseName) {
  const validClaimIds = new Set((Array.isArray(evidence) ? evidence : []).map((record) => record.claimId));
  const fallbackClaimIds = [...validClaimIds].slice(0, 2);
  const normalized = /** @type {{ anchorId: string, title: string, bodyScale: string, location: string, description: string, linkedClaimIds: string[] }[]} */ ((Array.isArray(visualAnchors) ? visualAnchors : [])
    .map((item, index) => {
      if (typeof item === 'string') {
        return {
          anchorId: normalizeArtifactScopedId('vanchor', undefined, index),
          title: `Visual anchor ${index + 1}`,
          bodyScale: 'story',
          location: 'case board',
          description: item,
          linkedClaimIds: fallbackClaimIds,
        };
      }

      if (!isRecord(item)) {
        return null;
      }

      return {
        anchorId: normalizeArtifactScopedId('vanchor', item.anchorId ?? item.id, index),
        title: toText(item.title ?? item.name ?? item.topic, `Visual anchor ${index + 1}`),
        bodyScale: toText(item.bodyScale ?? item.scale, 'story'),
        location: toText(item.location ?? item.sceneLocation ?? item.anatomicLocation, 'case board'),
        description: toText(
          item.description ?? item.visualDescription ?? item.prompt ?? item.summary,
          `Show a clear governed visual clue for ${canonicalDiseaseName}.`,
        ),
        linkedClaimIds: normalizeLinkedClaimIds(item.linkedClaimIds ?? item.claimIds, validClaimIds, fallbackClaimIds),
      };
    })
    .filter((item) => item && item.linkedClaimIds.length > 0));

  return normalized.length > 0
    ? normalized
    : [
      {
        anchorId: 'vanchor.placeholder.001',
        title: `${canonicalDiseaseName} visual review checkpoint`,
        bodyScale: 'story',
        location: 'case board',
        description: 'Show the detectives organizing source-backed clues before entering the body-world.',
        linkedClaimIds: fallbackClaimIds.length > 0 ? fallbackClaimIds : ['clm.placeholder'],
      },
    ];
}

/**
 * @param {string} testName
 * @returns {boolean}
 */
function looksLikeImagingTest(testName) {
  return /(ct|mri|x-?ray|ultrasound|scan|pet|imaging)/i.test(testName);
}

/**
 * @param {string} testName
 * @returns {boolean}
 */
function looksLikePathologyTest(testName) {
  return /(biopsy|pathology|histology|cytology|immunostain|flow cytometry)/i.test(testName);
}

/**
 * @param {string[]} tests
 * @param {string} purpose
 * @param {string} expectedFinding
 * @returns {any[]}
 */
function normalizeDiagnosticItems(tests, purpose, expectedFinding) {
  return tests.map((testName) => ({
    name: toText(testName, 'Diagnostic test'),
    purpose,
    expectedFinding,
    claimIds: [],
  }));
}

/**
 * @param {any} item
 * @param {number} index
 * @param {string} defaultPurpose
 * @param {string} defaultExpectedFinding
 * @returns {{ name: string, purpose: string, expectedFinding: string, claimIds?: string[] }}
 */
function normalizeDiagnosticStudy(item, index, defaultPurpose, defaultExpectedFinding) {
  if (typeof item === 'string') {
    return {
      name: item,
      purpose: defaultPurpose,
      expectedFinding: defaultExpectedFinding,
      claimIds: [],
    };
  }

  const record = isRecord(item) ? item : {};
  const claimIds = toSafeIdArray(record.claimIds ?? record.linkedClaimIds);

  return {
    name: toText(record.name ?? record.test ?? record.title, `Diagnostic test ${index + 1}`),
    purpose: toText(record.purpose ?? record.whyOrdered ?? record.rationale, defaultPurpose),
    expectedFinding: toText(record.expectedFinding ?? record.finding ?? record.result, defaultExpectedFinding),
    ...(claimIds.length > 0 ? { claimIds } : {}),
  };
}

/**
 * @param {any} item
 * @param {number} index
 * @returns {{ name: string, expectedFinding: string, claimIds?: string[] }}
 */
function normalizePathologyStudy(item, index) {
  if (typeof item === 'string') {
    return {
      name: item,
      expectedFinding: 'Pathology should confirm the disease-defining tissue or cellular finding.',
      claimIds: [],
    };
  }

  const record = isRecord(item) ? item : {};
  const claimIds = toSafeIdArray(record.claimIds ?? record.linkedClaimIds);

  return {
    name: toText(record.name ?? record.test ?? record.title, `Pathology test ${index + 1}`),
    expectedFinding: toText(
      record.expectedFinding ?? record.finding ?? record.result,
      'Pathology should confirm the disease-defining tissue or cellular finding.',
    ),
    ...(claimIds.length > 0 ? { claimIds } : {}),
  };
}

/**
 * @param {any} item
 * @param {number} index
 * @returns {{ disease: string, whyConsidered: string, whyLessLikely: string }}
 */
function normalizeDifferential(item, index) {
  if (typeof item === 'string') {
    return {
      disease: item,
      whyConsidered: 'It can share early clues with the target disease.',
      whyLessLikely: 'The evidence trail should distinguish this mimic during the reveal.',
    };
  }

  const record = isRecord(item) ? item : {};

  return {
    disease: toText(record.disease ?? record.name ?? record.diagnosis, `Differential ${index + 1}`),
    whyConsidered: toText(record.whyConsidered ?? record.reason ?? record.overlap, 'It can share early clues with the target disease.'),
    whyLessLikely: toText(record.whyLessLikely ?? record.distinguishingFeature ?? record.exclusionReason, 'The evidence trail should distinguish this mimic during the reveal.'),
  };
}

/**
 * @param {any} management
 * @returns {{ acuteStabilization: string[], definitiveTherapies: any[], monitoring: string[], notes: string[] }}
 */
function normalizeManagement(management = {}) {
  const acuteStabilization = Array.isArray(management.acuteStabilization)
    ? management.acuteStabilization.map((/** @type {unknown} */ item, /** @type {number} */ index) => toText(item, `Initial stabilization step ${index + 1}`))
    : (Array.isArray(management.stabilization ?? management.firstLine)
      ? (management.stabilization ?? management.firstLine).map((/** @type {unknown} */ item, /** @type {number} */ index) => toText(item, `Initial management step ${index + 1}`))
      : []);
  let definitiveTherapies = [];

  if (Array.isArray(management.definitiveTherapies) && management.definitiveTherapies.length > 0) {
    definitiveTherapies = management.definitiveTherapies.map((/** @type {any} */ therapy, /** @type {number} */ index) => {
      if (isRecord(therapy)) {
        return {
          name: toText(therapy.name ?? therapy.title, `Definitive therapy ${index + 1}`),
          mechanismOfAction: toText(
            therapy.mechanismOfAction ?? therapy.mechanism ?? therapy.rationale,
            'Review the evidence-linked mechanism of action before release.',
          ),
          whenUsed: toText(
            therapy.whenUsed ?? therapy.indication ?? therapy.timing,
            'Use when clinical review confirms the diagnosis and treatment context.',
          ),
          ...(Array.isArray(therapy.claimIds) ? { claimIds: clone(therapy.claimIds) } : {}),
        };
      }

      return {
        name: toText(therapy, `Definitive therapy ${index + 1}`),
        mechanismOfAction: `Use ${toText(therapy, `therapy ${index + 1}`)} as part of the disease-directed treatment plan once the diagnosis is supported.`,
        whenUsed: 'Use after the workup supports the diagnosis and specialty-directed care is appropriate.',
      };
    });
  } else if (Array.isArray(management.diseaseDirectedCare) && management.diseaseDirectedCare.length > 0) {
    definitiveTherapies = management.diseaseDirectedCare.map((/** @type {string} */ therapyName) => ({
      name: therapyName,
      mechanismOfAction: `Use ${therapyName} as part of the disease-directed treatment plan once the diagnosis is supported.`,
      whenUsed: 'Use after the workup supports the diagnosis and specialty-directed care is appropriate.',
    }));
  } else if (Array.isArray(management.escalation)) {
    definitiveTherapies = management.escalation.map((/** @type {string} */ step, /** @type {number} */ index) => ({
      name: `Escalation step ${index + 1}`,
      mechanismOfAction: step,
      whenUsed: 'Use when the clinical picture escalates beyond initial stabilization.',
    }));
  }

  return {
    acuteStabilization,
    definitiveTherapies,
    monitoring: Array.isArray(management.monitoring)
      ? management.monitoring.map((/** @type {unknown} */ item, /** @type {number} */ index) => toText(item, `Monitoring item ${index + 1}`))
      : [],
    notes: Array.isArray(management.notes ?? management.diseaseDirectedCare)
      ? (management.notes ?? management.diseaseDirectedCare).map((/** @type {unknown} */ item, /** @type {number} */ index) => toText(item, `Management note ${index + 1}`))
      : [],
  };
}

/**
 * @param {any} diagnostics
 * @returns {any}
 */
function normalizeDiagnostics(diagnostics = {}) {
  const firstLineTests = Array.isArray(diagnostics.firstLineTests) ? diagnostics.firstLineTests : [];
  const confirmatoryTests = Array.isArray(diagnostics.confirmatoryTests) ? diagnostics.confirmatoryTests : [];
  const derivedImaging = firstLineTests.filter((/** @type {string} */ testName) => looksLikeImagingTest(testName));
  const derivedPathology = confirmatoryTests.filter((/** @type {string} */ testName) => looksLikePathologyTest(testName));
  const derivedLabs = firstLineTests.filter((/** @type {string} */ testName) => !looksLikeImagingTest(testName) && !looksLikePathologyTest(testName));
  const diagnosticLogic = Array.isArray(diagnostics.diagnosticLogic) && diagnostics.diagnosticLogic.length > 0
    ? clone(diagnostics.diagnosticLogic)
    : [
      firstLineTests[0] ? `Start with ${firstLineTests[0]} to narrow the diagnosis and establish the main clinical clue.` : 'Start with the most informative initial test to narrow the diagnosis.',
      confirmatoryTests[0] ? `Use ${confirmatoryTests[0]} to confirm the mechanism and separate this disease from close mimics.` : 'Use confirmatory testing to prove the mechanism and rule out close mimics.',
    ];

  return {
    labs: Array.isArray(diagnostics.labs) && diagnostics.labs.length > 0
      ? diagnostics.labs.map((/** @type {unknown} */ item, /** @type {number} */ index) => normalizeDiagnosticStudy(
        item,
        index,
        'Establish the initial diagnostic signal for the suspected disease.',
        'Findings should support the suspected diagnosis or show the expected physiologic disturbance.',
      ))
      : normalizeDiagnosticItems(
        derivedLabs,
        'Establish the initial diagnostic signal for the suspected disease.',
        'Findings should support the suspected diagnosis or show the expected physiologic disturbance.',
      ),
    imaging: Array.isArray(diagnostics.imaging) && diagnostics.imaging.length > 0
      ? diagnostics.imaging.map((/** @type {unknown} */ item, /** @type {number} */ index) => normalizeDiagnosticStudy(
        item,
        index,
        'Visualize the most likely anatomic or organ-level clue.',
        'Imaging should show a finding that supports the suspected disease process.',
      ))
      : normalizeDiagnosticItems(
        derivedImaging,
        'Visualize the most likely anatomic or organ-level clue.',
        'Imaging should show a finding that supports the suspected disease process.',
      ),
    pathology: Array.isArray(diagnostics.pathology) && diagnostics.pathology.length > 0
      ? diagnostics.pathology.map((/** @type {unknown} */ item, /** @type {number} */ index) => normalizePathologyStudy(item, index))
      : derivedPathology.map((/** @type {string} */ testName) => ({
        name: testName,
        expectedFinding: 'Pathology should confirm the disease-defining tissue or cellular finding.',
        claimIds: [],
      })),
    diagnosticLogic: toTextArray(diagnosticLogic),
    differentials: Array.isArray(diagnostics.differentials)
      ? diagnostics.differentials.map((/** @type {unknown} */ item, /** @type {number} */ index) => normalizeDifferential(item, index))
      : [],
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
      if (isResearchableDiseaseInput(rawInput)) {
        return {
          schemaVersion: SCHEMA_VERSION,
          id: createId('can'),
          rawInput,
          normalizedInput,
          resolutionStatus: 'new-disease',
          confidence: 0.56,
          canonicalDiseaseName: toCanonicalDiseaseLabel(rawInput),
          aliases: [rawInput.trim()],
          diseaseCategory: 'provisional-research-needed',
          candidateMatches: [],
          notes: 'No governed disease entry matched the intake string, but the input is specific enough to build a provisional knowledge pack through research assembly.',
        };
      }

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
      points: normalizeClinicalTeachingPoints(
        knowledgePack.clinicalTeachingPoints,
        evidenceRecords,
        knowledgePack.canonicalDiseaseName,
      ),
    };

    const visualAnchorCatalog = {
      schemaVersion: SCHEMA_VERSION,
      id: createId('vac'),
      canonicalDiseaseName: knowledgePack.canonicalDiseaseName,
      anchors: normalizeVisualAnchors(
        knowledgePack.visualAnchors,
        evidenceRecords,
        knowledgePack.canonicalDiseaseName,
      ),
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

    const clinicalSummary = normalizeClinicalSummary(knowledgePack.clinicalSummary, knowledgePack.canonicalDiseaseName);
    const physiologyPrerequisites = normalizePhysiologyPrerequisites(
      knowledgePack.physiologyPrerequisites,
      knowledgePack.canonicalDiseaseName,
    );
    const pathophysiology = normalizePathophysiology(
      knowledgePack.pathophysiology,
      clinicalSummary,
      evidenceRecords,
      knowledgePack.canonicalDiseaseName,
    );

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
      clinicalSummary,
      physiologyPrerequisites,
      pathophysiology,
      presentation: normalizePresentation(knowledgePack.presentation, clinicalSummary),
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

    return this.buildDiseasePacketFromKnowledgePack(
      this.getKnowledgePack(canonicalDisease.canonicalDiseaseName),
      options,
    );
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

    return this.buildClinicalPackageFromKnowledgePack(
      this.getKnowledgePack(canonicalDisease.canonicalDiseaseName),
      options,
    );
  }

  /**
   * @param {any} knowledgePack
   * @param {{ governanceDecisions?: any[], contradictionResolutions?: any[] }} [options]
   * @returns {any}
   */
  buildDiseasePacketFromKnowledgePack(knowledgePack, options = {}) {
    return this.buildGovernedClinicalArtifacts(knowledgePack, options).diseasePacket;
  }

  /**
   * @param {any} knowledgePack
   * @param {{ governanceDecisions?: any[], contradictionResolutions?: any[] }} [options]
   * @returns {{ diseasePacket: any, factTable: any, evidenceGraph: any, clinicalTeachingPoints: any, visualAnchorCatalog: any, sourceRecords: any[], evidenceRecords: any[] }}
   */
  buildClinicalPackageFromKnowledgePack(knowledgePack, options = {}) {
    return this.buildGovernedClinicalArtifacts(knowledgePack, options);
  }

  /**
   * @param {any} knowledgePack
   * @param {string} rawInput
   * @param {'exact' | 'alias' | 'ambiguous-suggestion'} [matchType]
   * @returns {any}
   */
  buildCanonicalDiseaseFromKnowledgePack(knowledgePack, rawInput, matchType = 'exact') {
    return {
      schemaVersion: SCHEMA_VERSION,
      id: createId('can'),
      rawInput,
      normalizedInput: normalizeDiseaseInput(rawInput),
      resolutionStatus: 'resolved',
      confidence: matchType === 'exact' ? 0.99 : 0.96,
      canonicalDiseaseName: knowledgePack.canonicalDiseaseName,
      aliases: clone(knowledgePack.aliases),
      ontologyId: knowledgePack.ontologyId,
      diseaseCategory: knowledgePack.diseaseCategory,
      candidateMatches: [
        {
          canonicalDiseaseName: knowledgePack.canonicalDiseaseName,
          ontologyId: knowledgePack.ontologyId,
          matchType,
        },
      ],
      notes: knowledgePack.packStatus === 'promoted'
        ? 'Resolved through a promoted governed knowledge pack.'
        : 'Resolved through a governed knowledge pack.',
    };
  }
}

/**
 * @param {{ rootDir?: string }} [options]
 * @returns {ClinicalRetrievalService}
 */
export function createClinicalRetrievalService(options = {}) {
  return new ClinicalRetrievalService(options);
}
