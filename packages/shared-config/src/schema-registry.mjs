import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import AjvImport from 'ajv/dist/2020.js';

const Ajv = /** @type {any} */ (AjvImport);

/**
 * @typedef {{
 *   instancePath?: string,
 *   message?: string,
 *   params?: Record<string, unknown>,
 *   schemaPath?: string,
 * }} ValidationError
 */

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isDateTime(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * @param {string} rootDir
 * @returns {Promise<string[]>}
 */
export async function listContractFiles(rootDir) {
  const contractsDir = path.join(rootDir, 'contracts');
  const entries = await readdir(contractsDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.schema.json'))
    .map((entry) => path.join(contractsDir, entry.name))
    .sort();
}

/**
 * @param {string} schemaFilePath
 * @returns {string}
 */
export function getSchemaId(schemaFilePath) {
  return `contracts/${path.basename(schemaFilePath)}`;
}

/**
 * @param {string} schemaFilePath
 * @returns {string}
 */
export function getExamplePathForSchema(schemaFilePath) {
  const baseName = path.basename(schemaFilePath, '.schema.json').replaceAll('-', '_');
  return path.join(path.dirname(path.dirname(schemaFilePath)), 'examples', `sample_${baseName}.json`);
}

/**
 * @param {readonly ValidationError[] | null | undefined} errors
 * @returns {string}
 */
export function formatValidationErrors(errors) {
  if (!errors || errors.length === 0) {
    return 'Unknown schema validation error.';
  }

  return errors
    .map((error) => {
      const location = error.instancePath || '/';
      const message = error.message || 'validation failed';

      return `${location}: ${message}`;
    })
    .join('\n');
}

/**
 * @param {string} rootDir
 * @returns {Promise<{
 *   validateBySchemaId: (schemaId: string, data: unknown) => { valid: boolean, errors: readonly ValidationError[] | null | undefined },
 *   assertValid: (schemaId: string, data: unknown) => void,
 *   schemaIds: string[],
 * }>}
 */
export async function createSchemaRegistry(rootDir) {
  const ajv = new Ajv({
    allErrors: true,
    strict: false,
  });
  ajv.addFormat('date-time', {
    type: 'string',
    validate: isDateTime,
  });
  ajv.addFormat('email', {
    type: 'string',
    validate: isEmail,
  });

  const schemaFiles = await listContractFiles(rootDir);
  const schemaIds = [];

  for (const schemaFile of schemaFiles) {
    const schema = JSON.parse(await readFile(schemaFile, 'utf8'));
    ajv.addSchema(schema, getSchemaId(schemaFile));
    schemaIds.push(getSchemaId(schemaFile));
  }

  /**
   * @param {string} schemaId
   * @param {unknown} data
   * @returns {{ valid: boolean, errors: readonly ValidationError[] | null | undefined }}
   */
  const validateBySchemaId = (schemaId, data) => {
    const validator = ajv.getSchema(schemaId);

    if (!validator) {
      throw new Error(`Schema ${schemaId} is not registered.`);
    }

    const valid = Boolean(validator(data));

    return {
      errors: validator.errors,
      valid,
    };
  };

  return {
    schemaIds,
    validateBySchemaId,
    assertValid(schemaId, data) {
      const result = validateBySchemaId(schemaId, data);

      if (!result.valid) {
        throw new Error(`Schema validation failed for ${schemaId}\n${formatValidationErrors(result.errors)}`);
      }
    },
  };
}
