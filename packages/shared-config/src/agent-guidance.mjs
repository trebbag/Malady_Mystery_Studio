import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { findRepoRoot } from './repo-paths.mjs';

const INDEX_PATH = path.join('data', 'agent-guidance', 'guidance-index.json');

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * @param {string} rootDir
 * @param {string} relativePath
 * @returns {unknown}
 */
function readJsonFromRoot(rootDir, relativePath) {
  return JSON.parse(readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

/**
 * @param {string} filePath
 * @returns {string}
 */
export function calculateSha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

/**
 * @param {string} [rootDir]
 * @returns {any}
 */
export function loadGuidanceIndex(rootDir = findRepoRoot(import.meta.url)) {
  return readJsonFromRoot(rootDir, INDEX_PATH);
}

/**
 * @param {any} pack
 * @returns {string}
 */
export function getGuidancePackVersionId(pack) {
  return `${pack.id}:${pack.version}`;
}

/**
 * @param {any[]} packs
 * @returns {string[]}
 */
export function getGuidancePackVersionIds(packs) {
  return packs.map(getGuidancePackVersionId);
}

/**
 * @param {any[]} packs
 * @returns {Array<{ guidancePackId: string, version: string, ruleIds: string[], sourceDocIds: string[] }>}
 */
export function buildSourceGuidanceProvenance(packs) {
  return packs.map((pack) => ({
    guidancePackId: pack.id,
    version: pack.version,
    ruleIds: Array.isArray(pack.rules)
      ? pack.rules.map((/** @type {any} */ rule) => rule.id).filter(Boolean)
      : [],
    sourceDocIds: Array.isArray(pack.sourceDocIds) ? pack.sourceDocIds : [],
  }));
}

/**
 * @param {string} packId
 * @param {string} [rootDir]
 * @returns {any}
 */
export function loadAgentGuidancePack(packId, rootDir = findRepoRoot(import.meta.url)) {
  const index = loadGuidanceIndex(rootDir);
  const entry = (index.guidancePacks ?? []).find((/** @type {any} */ candidate) => candidate.id === packId);

  if (!entry || typeof entry.path !== 'string') {
    throw new Error(`Agent guidance pack ${packId} is not registered.`);
  }

  return readJsonFromRoot(rootDir, entry.path);
}

/**
 * @param {string} stage
 * @param {string} [rootDir]
 * @returns {any[]}
 */
export function loadAgentGuidancePacksForStage(stage, rootDir = findRepoRoot(import.meta.url)) {
  const index = loadGuidanceIndex(rootDir);

  return (index.guidancePacks ?? [])
    .map((/** @type {any} */ entry) => readJsonFromRoot(rootDir, entry.path))
    .filter((/** @type {any} */ pack) => Array.isArray(pack.pipelineStages) && pack.pipelineStages.includes(stage));
}

/**
 * @param {readonly string[]} packIds
 * @param {string} [rootDir]
 * @returns {any[]}
 */
export function loadAgentGuidancePacks(packIds, rootDir = findRepoRoot(import.meta.url)) {
  return packIds.map((packId) => loadAgentGuidancePack(packId, rootDir));
}

/**
 * @param {any} index
 * @param {string} rootDir
 * @returns {string[]}
 */
export function validateGuidanceIndex(index, rootDir = findRepoRoot(import.meta.url)) {
  const failures = [];
  const sourceIds = new Set();

  if (!isRecord(index)) {
    return ['Guidance index must be a JSON object.'];
  }

  for (const source of Array.isArray(index.sources) ? index.sources : []) {
    if (!source.id || !source.importedFilename || !source.sha256) {
      failures.push('Every guidance source must include id, importedFilename, and sha256.');
      continue;
    }

    sourceIds.add(source.id);
    const sourcePath = path.join(rootDir, source.importedFilename);

    try {
      const actualHash = calculateSha256(sourcePath);

      if (actualHash !== source.sha256) {
        failures.push(`Guidance source ${source.id} hash mismatch: expected ${source.sha256}, got ${actualHash}.`);
      }
    } catch (error) {
      failures.push(`Guidance source ${source.id} could not be read: ${String(error)}.`);
    }
  }

  for (const packEntry of Array.isArray(index.guidancePacks) ? index.guidancePacks : []) {
    if (!packEntry.id || !packEntry.path || !Array.isArray(packEntry.sourceDocIds)) {
      failures.push('Every guidance pack index entry must include id, path, and sourceDocIds.');
      continue;
    }

    for (const sourceDocId of packEntry.sourceDocIds) {
      if (!sourceIds.has(sourceDocId)) {
        failures.push(`Guidance pack ${packEntry.id} references unknown source ${sourceDocId}.`);
      }
    }

    try {
      const pack = /** @type {any} */ (readJsonFromRoot(rootDir, packEntry.path));

      if (pack.id !== packEntry.id || pack.version !== packEntry.version) {
        failures.push(`Guidance pack ${packEntry.id} index metadata does not match the pack file.`);
      }

      for (const sourceDocId of pack.sourceDocIds ?? []) {
        if (!sourceIds.has(sourceDocId)) {
          failures.push(`Guidance pack ${pack.id} references unknown source ${sourceDocId}.`);
        }
      }
    } catch (error) {
      failures.push(`Guidance pack ${packEntry.id} could not be loaded: ${String(error)}.`);
    }
  }

  return failures;
}
