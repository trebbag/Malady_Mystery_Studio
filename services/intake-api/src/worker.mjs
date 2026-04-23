import path from 'node:path';

import { loadDotEnv } from '../../../packages/shared-config/src/env.mjs';
import { createSchemaRegistry } from '../../../packages/shared-config/src/schema-registry.mjs';
import { findRepoRoot } from '../../../packages/shared-config/src/repo-paths.mjs';
import { loadWorkflowSpec } from '../../orchestrator/src/workflow-machine.mjs';
import { createRenderExecutionService } from '../../render-execution/src/service.mjs';
import { processRenderJob } from './app.mjs';
import { createMetadataStore } from './metadata-store.mjs';
import { createPlatformRuntime } from './platform-runtime.mjs';

loadDotEnv({ moduleUrl: import.meta.url });

const rootDir = findRepoRoot(import.meta.url);
const dbFilePath = process.env.PLATFORM_DB_FILE ?? path.join(rootDir, 'var', 'db', 'platform.sqlite');
const objectStoreDir = process.env.OBJECT_STORE_DIR ?? path.join(rootDir, 'var', 'object-store');
const platformRuntime = createPlatformRuntime({
  rootDir,
  objectStoreDir,
});

if (
  platformRuntime.objectStorageKind !== 'filesystem'
  || platformRuntime.queueBackend !== 'in-process'
  || (process.env.TELEMETRY_BACKEND ?? 'stdout') !== 'stdout'
) {
  console.warn('Managed runtime services are partially enabled. The worker is using managed object storage, queue, or telemetry adapters while metadata remains on the local SQLite store.');
}

if (typeof platformRuntime.queueAdapter?.createReceiver !== 'function') {
  console.log('ASYNC_QUEUE_BACKEND is in-process. No separate worker is required for local execution.');
  process.exit(0);
}

const store = await createMetadataStore({
  rootDir,
  dbFilePath,
  objectStoreDir,
  objectStorage: platformRuntime.objectStorage,
  metadataStoreKind: platformRuntime.metadataStoreKind,
  telemetry: platformRuntime.telemetry,
});
const schemaRegistry = await createSchemaRegistry(rootDir);
const workflowSpec = await loadWorkflowSpec(rootDir);
const renderExecutionService = createRenderExecutionService({
  provider: process.env.RENDER_PROVIDER,
  apiKey: process.env.RENDER_PROVIDER_API_KEY ?? process.env.OPENAI_API_KEY,
});

const shutdownReceiver = await platformRuntime.queueAdapter.createReceiver('render-execution', async (/** @type {any} */ message) => {
  const workflowRun = store.getWorkflowRun(String(message.workflowRunId ?? ''));
  const renderJob = store.getArtifact('render-job', String(message.renderJobId ?? ''));

  if (!workflowRun || !renderJob) {
    platformRuntime.telemetry.warn('worker.render-job.missing', {
      workflowRunId: String(message.workflowRunId ?? ''),
      renderJobId: String(message.renderJobId ?? ''),
    });
    return;
  }

  await processRenderJob({
    store,
    schemaRegistry,
    workflowSpec,
    workflowRun,
    renderJob,
    renderExecutionService,
    telemetry: platformRuntime.telemetry,
  });
});

console.log('Render worker listening on queue render-execution.');

/**
 * @returns {Promise<void>}
 */
async function shutdown() {
  await shutdownReceiver();
  await platformRuntime.queueAdapter.close();
  const closeAsync = /** @type {any} */ (store).closeAsync;

  if (typeof closeAsync === 'function') {
    await closeAsync.call(store);
  } else {
    store.close();
  }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    void shutdown().finally(() => process.exit(0));
  });
}
