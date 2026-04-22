import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * @param {Buffer | string} value
 * @returns {string}
 */
function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * @param {string} value
 * @returns {string}
 */
function normalizePathSegment(value) {
  return value.replace(/[^A-Za-z0-9._-]+/g, '-');
}

export class ObjectStorage {
  /**
   * @param {{ baseDir: string }} options
   */
  constructor(options) {
    this.baseDir = options.baseDir;
  }

  /**
   * @param {string} tenantId
   * @param {string} namespace
   * @param {string} objectId
   * @param {Buffer | string} contents
   * @param {{ extension: string }} options
   * @returns {{ location: string, checksum: string, byteLength: number }}
   */
  putObject(tenantId, namespace, objectId, contents, options) {
    const relativeLocation = path.join(
      normalizePathSegment(tenantId),
      normalizePathSegment(namespace),
      `${normalizePathSegment(objectId)}.${options.extension}`,
    );
    const absoluteLocation = path.join(this.baseDir, relativeLocation);
    mkdirSync(path.dirname(absoluteLocation), { recursive: true });
    const buffer = Buffer.isBuffer(contents) ? contents : Buffer.from(contents, 'utf8');
    const tempPath = `${absoluteLocation}.tmp`;

    writeFileSync(tempPath, buffer);
    renameSync(tempPath, absoluteLocation);

    return {
      location: relativeLocation,
      checksum: sha256(buffer),
      byteLength: buffer.byteLength,
    };
  }

  /**
   * @param {string} location
   * @returns {Buffer}
   */
  getObject(location) {
    return readFileSync(path.join(this.baseDir, location));
  }

  /**
   * @param {string} location
   * @returns {any}
   */
  getJson(location) {
    return JSON.parse(this.getObject(location).toString('utf8'));
  }

  /**
   * @param {string} location
   * @returns {string}
   */
  getText(location) {
    return this.getObject(location).toString('utf8');
  }
}
