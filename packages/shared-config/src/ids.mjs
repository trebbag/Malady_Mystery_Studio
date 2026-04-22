import { randomUUID } from 'node:crypto';

/**
 * @param {string} prefix
 * @returns {string}
 */
export function createId(prefix) {
  return `${prefix}.${randomUUID()}`;
}
