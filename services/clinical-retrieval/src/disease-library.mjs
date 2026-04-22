import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { findRepoRoot } from '../../../packages/shared-config/src/repo-paths.mjs';

const KNOWLEDGE_PACK_DIRECTORY = path.join('services', 'clinical-retrieval', 'knowledge-packs');

/** @type {Map<string, Record<string, any>>} */
const libraryCache = new Map();
/** @type {Map<string, Record<string, any[]>>} */
const ambiguousInputCache = new Map();

/**
 * @param {string} value
 * @returns {string}
 */
function normalizeKey(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * @param {string} rootDir
 * @returns {string}
 */
function getKnowledgePackDir(rootDir) {
  return path.join(rootDir, KNOWLEDGE_PACK_DIRECTORY);
}

/**
 * @param {string} rootDir
 * @returns {any[]}
 */
function loadKnowledgePackList(rootDir) {
  const knowledgePackDir = getKnowledgePackDir(rootDir);
  const fileNames = readdirSync(knowledgePackDir)
    .filter((fileName) => fileName.endsWith('.json') && fileName !== 'ambiguous-inputs.json')
    .sort();

  return fileNames.flatMap((fileName) => {
    const contents = readFileSync(path.join(knowledgePackDir, fileName), 'utf8');
    const parsed = JSON.parse(contents);

    return Array.isArray(parsed) ? parsed : [parsed];
  });
}

/**
 * @param {string} rootDir
 * @returns {Record<string, any[]>}
 */
function loadAmbiguousInputs(rootDir) {
  const cacheKey = rootDir;

  if (ambiguousInputCache.has(cacheKey)) {
    const cached = ambiguousInputCache.get(cacheKey);

    if (cached) {
      return cached;
    }
  }

  const ambiguousInputPath = path.join(getKnowledgePackDir(rootDir), 'ambiguous-inputs.json');
  const parsed = JSON.parse(readFileSync(ambiguousInputPath, 'utf8'));
  ambiguousInputCache.set(cacheKey, parsed);
  return parsed;
}

/**
 * @param {string} [rootDir]
 * @returns {Record<string, any>}
 */
export function createSeedDiseaseLibrary(rootDir = findRepoRoot(import.meta.url)) {
  const cacheKey = rootDir;

  if (libraryCache.has(cacheKey)) {
    const cached = libraryCache.get(cacheKey);

    if (cached) {
      return cached;
    }
  }

  /** @type {Record<string, any>} */
  const library = {};

  for (const knowledgePack of loadKnowledgePackList(rootDir)) {
    library[normalizeKey(knowledgePack.canonicalDiseaseName)] = structuredClone(knowledgePack);
  }

  libraryCache.set(cacheKey, library);
  return library;
}

export const AMBIGUOUS_INPUTS = loadAmbiguousInputs(findRepoRoot(import.meta.url));
