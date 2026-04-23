import { createHash } from 'node:crypto';

import { BlobServiceClient } from '@azure/storage-blob';

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
  return value.replace(/[^A-Za-z0-9._/-]+/g, '-');
}

/**
 * @param {import('stream').Readable | NodeJS.ReadableStream | null | undefined} stream
 * @returns {Promise<Buffer>}
 */
async function readStreamToBuffer(stream) {
  if (!stream) {
    return Buffer.alloc(0);
  }

  /** @type {Buffer[]} */
  const chunks = [];

  for await (const chunk of /** @type {AsyncIterable<Buffer | string>} */ (stream)) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

export class AzureBlobObjectStorage {
  /**
   * @param {{ connectionString: string, containerName: string, prefix?: string }} options
   */
  constructor(options) {
    this.prefix = options.prefix ?? '';
    this.containerName = options.containerName;
    this.client = BlobServiceClient.fromConnectionString(options.connectionString);
  }

  async getContainerClient() {
    const containerClient = this.client.getContainerClient(this.containerName);
    await containerClient.createIfNotExists();
    return containerClient;
  }

  /**
   * @param {string} tenantId
   * @param {string} namespace
   * @param {string} objectId
   * @param {Buffer | string} contents
   * @param {{ extension: string, contentType?: string }} options
   * @returns {Promise<{ location: string, checksum: string, byteLength: number }>}
   */
  async putObject(tenantId, namespace, objectId, contents, options) {
    const buffer = Buffer.isBuffer(contents) ? contents : Buffer.from(contents, 'utf8');
    const location = [
      this.prefix.trim().replace(/^\/+|\/+$/g, ''),
      normalizePathSegment(tenantId),
      normalizePathSegment(namespace),
      `${normalizePathSegment(objectId)}.${options.extension}`,
    ].filter(Boolean).join('/');
    const containerClient = await this.getContainerClient();
    const blobClient = containerClient.getBlockBlobClient(location);
    await blobClient.uploadData(buffer, {
      blobHTTPHeaders: {
        blobContentType: options.contentType ?? 'application/octet-stream',
      },
    });

    return {
      location,
      checksum: sha256(buffer),
      byteLength: buffer.byteLength,
    };
  }

  /**
   * @param {string} location
   * @returns {Promise<Buffer>}
   */
  async getObject(location) {
    const containerClient = await this.getContainerClient();
    const blobClient = containerClient.getBlockBlobClient(location);
    const downloadResponse = await blobClient.download();
    return readStreamToBuffer(downloadResponse.readableStreamBody);
  }

  /**
   * @param {string} location
   * @returns {Promise<any>}
   */
  async getJson(location) {
    return JSON.parse((await this.getObject(location)).toString('utf8'));
  }

  /**
   * @param {string} location
   * @returns {Promise<string>}
   */
  async getText(location) {
    return (await this.getObject(location)).toString('utf8');
  }
}
