import { AMBIGUOUS_INPUTS } from './disease-library.mjs';

/** @type {Record<string, any[]>} */
const ambiguousInputs = AMBIGUOUS_INPUTS;

/**
 * @param {string} value
 * @returns {string}
 */
export function normalizeDiseaseInput(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * @param {Record<string, any>} library
 * @returns {{
 *   findAmbiguousMatches: (input: string) => any[] | null,
 *   findDiseaseByInput: (input: string) => { diseaseKey: string, diseaseEntry: any, exactCanonicalMatch: boolean, normalizedInput: string } | null,
 *   findDiseaseByCanonicalName: (canonicalDiseaseName: string) => { diseaseKey: string, diseaseEntry: any, normalizedInput: string } | null,
 * }}
 */
export function createOntologyAdapter(library) {
  /** @type {Map<string, string>} */
  const aliasIndex = new Map();

  for (const [diseaseKey, entry] of Object.entries(library)) {
    aliasIndex.set(normalizeDiseaseInput(entry.canonicalDiseaseName), diseaseKey);

    for (const alias of entry.aliases) {
      aliasIndex.set(normalizeDiseaseInput(alias), diseaseKey);
    }
  }

  return {
    findAmbiguousMatches(input) {
      return ambiguousInputs[normalizeDiseaseInput(input)] ?? null;
    },
    findDiseaseByInput(input) {
      const normalizedInput = normalizeDiseaseInput(input);
      const diseaseKey = aliasIndex.get(normalizedInput);

      if (!diseaseKey) {
        return null;
      }

      const diseaseEntry = library[diseaseKey];

      return {
        diseaseKey,
        diseaseEntry,
        exactCanonicalMatch: normalizeDiseaseInput(diseaseEntry.canonicalDiseaseName) === normalizedInput,
        normalizedInput,
      };
    },
    findDiseaseByCanonicalName(canonicalDiseaseName) {
      const normalizedInput = normalizeDiseaseInput(canonicalDiseaseName);
      const diseaseKey = aliasIndex.get(normalizedInput);

      if (!diseaseKey) {
        return null;
      }

      return {
        diseaseKey,
        diseaseEntry: library[diseaseKey],
        normalizedInput,
      };
    },
  };
}
