import path from 'node:path';

import { findRepoRoot } from '../../../packages/shared-config/src/repo-paths.mjs';
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
 *   localStorageOnly?: boolean,
 * }} PlatformRuntimeOptions
 */

/**
 * @param {PlatformRuntimeOptions} [options]
 */
export function createObjectStorage(options = {}) {
  return {
    kind: 'filesystem',
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
  const metadataStoreKind = 'sqlite';
  const queueBackend = 'in-process';
  const telemetryBackend = options.telemetryBackend ?? process.env.TELEMETRY_BACKEND ?? 'stdout';
  const objectStorage = options.objectStorage ?? createObjectStorage({
    objectStoreDir: options.objectStoreDir,
  });
  const runtimeMode = 'local';
  const queueAdapter = options.queueAdapter ?? createQueueAdapter({
    backend: queueBackend,
    connectionString: options.serviceBusConnectionString,
  });
  const telemetry = options.telemetry ?? createTelemetry({
    backend: options.telemetryBackend,
  });

  return {
    rootDir,
    runtimeMode,
    metadataStoreKind,
    objectStorageKind: objectStorage.kind,
    objectStorage: objectStorage.client,
    queueBackend,
    queueAdapter,
    telemetry,
  };
}
