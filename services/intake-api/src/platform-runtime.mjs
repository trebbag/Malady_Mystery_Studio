import path from 'node:path';

import { findRepoRoot } from '../../../packages/shared-config/src/repo-paths.mjs';
import { AzureBlobObjectStorage } from './azure-object-storage.mjs';
import { ObjectStorage } from './object-storage.mjs';
import { createQueueAdapter } from './queue-adapters.mjs';
import { createTelemetry } from './telemetry.mjs';

/**
 * @typedef {{
 *   objectStoreBackend?: string,
 *   objectStoreDir?: string,
 *   blobConnectionString?: string,
 *   blobContainerName?: string,
 *   blobPrefix?: string,
 *   rootDir?: string,
 *   objectStorage?: any,
 *   queueAdapter?: any,
 *   queueBackend?: string,
 *   serviceBusConnectionString?: string,
 *   telemetry?: any,
  *   telemetryBackend?: string,
 *   metadataStoreKind?: string,
 *   runtimeMode?: string,
 * }} PlatformRuntimeOptions
 */

/**
 * @param {PlatformRuntimeOptions} [options]
 */
export function createObjectStorage(options = {}) {
  const objectStoreBackend = options.objectStoreBackend ?? process.env.OBJECT_STORE_BACKEND ?? 'filesystem';

  if (objectStoreBackend === 'azure-blob') {
    return {
      kind: objectStoreBackend,
      client: new AzureBlobObjectStorage({
        connectionString: options.blobConnectionString ?? process.env.AZURE_BLOB_CONNECTION_STRING ?? '',
        containerName: options.blobContainerName ?? process.env.AZURE_BLOB_CONTAINER_NAME ?? 'dcp-artifacts',
        prefix: options.blobPrefix ?? process.env.AZURE_BLOB_PREFIX ?? '',
      }),
    };
  }

  return {
    kind: objectStoreBackend,
    client: new ObjectStorage({
      baseDir: options.objectStoreDir ?? process.env.OBJECT_STORE_DIR ?? path.join(findRepoRoot(import.meta.url), 'var', 'object-store'),
    }),
  };
}

/**
 * @param {PlatformRuntimeOptions} [options]
 */
export function createPlatformRuntime(options = {}) {
  const rootDir = options.rootDir ?? findRepoRoot(import.meta.url);
  const runtimeMode = options.runtimeMode
    ?? process.env.RUNTIME_MODE
    ?? ((options.metadataStoreKind ?? process.env.METADATA_STORE_BACKEND ?? 'sqlite') !== 'sqlite'
      ? 'managed'
      : 'local');
  const objectStorage = options.objectStorage ?? createObjectStorage({
    objectStoreBackend: options.objectStoreBackend,
    objectStoreDir: options.objectStoreDir,
    blobConnectionString: options.blobConnectionString,
    blobContainerName: options.blobContainerName,
    blobPrefix: options.blobPrefix,
  });
  const queueAdapter = options.queueAdapter ?? createQueueAdapter({
    backend: options.queueBackend,
    connectionString: options.serviceBusConnectionString,
  });
  const telemetry = options.telemetry ?? createTelemetry({
    backend: options.telemetryBackend,
  });

  return {
    rootDir,
    runtimeMode,
    metadataStoreKind: options.metadataStoreKind ?? process.env.METADATA_STORE_BACKEND ?? 'sqlite',
    objectStorageKind: objectStorage.kind,
    objectStorage: objectStorage.client,
    queueBackend: options.queueBackend ?? process.env.ASYNC_QUEUE_BACKEND ?? 'in-process',
    queueAdapter,
    telemetry,
  };
}
