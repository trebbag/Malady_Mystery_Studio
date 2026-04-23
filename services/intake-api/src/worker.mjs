import path from 'node:path';

import { createSchemaRegistry } from '../../../packages/shared-config/src/schema-registry.mjs';
import { findRepoRoot } from '../../../packages/shared-config/src/repo-paths.mjs';
import { loadWorkflowSpec } from '../../orchestrator/src/workflow-machine.mjs';
import { createRenderExecutionService } from '../../render-execution/src/service.mjs';
import { processRenderJob } from './app.mjs';
import { createPlatformRuntime } from './platform-runtime.mjs';
import { PlatformStore } from './store.mjs';

const rootDir = findRepoRoot(import.meta.url);
const dbFilePath = process.env.PLATFORM_DB_FILE ?? path.join(rootDir, 'var', 'db', 'platform.sqlite');
const objectStoreDir = process.env.OBJECT_STORE_DIR ?? path.join(rootDir, 'var', 'object-store');
const platformRuntime = createPlatformRuntime({
  rootDir,
  objectStoreDir,
});

if (platformRuntime.metadataStoreKind !== 'sqlite' || platformRuntime.objectStorageKind !== 'filesystem') {
  console.warn('Managed metadata/object-store adapters are scaffolded, but the worker still executes against the local SQLite/filesystem runtime in this tranche.');
}

if (typeof platformRuntime.queueAdapter?.createReceiver !== 'function') {
  console.log('ASYNC_QUEUE_BACKEND is in-process. No separate worker is required for local execution.');
  process.exit(0);
}

const store = new PlatformStore({
  rootDir,
  dbFilePath,
  objectStoreDir,
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
  store.close();
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    void shutdown().finally(() => process.exit(0));
  });
}
