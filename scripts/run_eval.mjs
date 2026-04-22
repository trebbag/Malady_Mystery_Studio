import path from 'node:path';

import { createSchemaRegistry } from '../packages/shared-config/src/schema-registry.mjs';
import { findRepoRoot } from '../packages/shared-config/src/repo-paths.mjs';
import { getActorFromRequest } from '../services/intake-api/src/auth.mjs';
import { createEvalService, deriveEvalStatus } from '../services/intake-api/src/eval-service.mjs';
import { PlatformStore } from '../services/intake-api/src/store.mjs';
import { createExporterService } from '../services/exporter/src/service.mjs';

const rootDir = findRepoRoot(import.meta.url);
const runIdIndex = process.argv.indexOf('--run-id');
const runId = runIdIndex >= 0 ? process.argv[runIdIndex + 1] : null;

if (!runId) {
  console.error('Usage: pnpm eval:run -- --run-id <runId>');
  process.exit(1);
}

const dbFilePath = process.env.PLATFORM_DB_FILE ?? path.join(rootDir, 'var', 'db', 'platform.sqlite');
const objectStoreDir = process.env.OBJECT_STORE_DIR ?? path.join(rootDir, 'var', 'object-store');
const store = new PlatformStore({
  rootDir,
  dbFilePath,
  objectStoreDir,
});
const schemaRegistry = await createSchemaRegistry(rootDir);
const exporterService = createExporterService();
const evalService = createEvalService({
  rootDir,
  exporterService,
});

try {
  const workflowRun = store.getWorkflowRun(runId);

  if (!workflowRun) {
    console.error(`Workflow run ${runId} was not found.`);
    process.exit(1);
  }

  const actor = getActorFromRequest();
  const evalRun = evalService.runForWorkflowRun({
    store,
    workflowRun,
    actor,
  });
  schemaRegistry.assertValid('contracts/eval-run.schema.json', evalRun);
  store.saveArtifact('eval-run', evalRun.id, evalRun, {
    tenantId: workflowRun.tenantId,
  });

  const nextArtifacts = workflowRun.artifacts.filter((artifactReference) => !(
    artifactReference.artifactType === 'eval-run' && artifactReference.artifactId === evalRun.id
  ));
  nextArtifacts.push({
    artifactType: 'eval-run',
    artifactId: evalRun.id,
    status: evalRun.summary.allThresholdsMet ? 'approved' : 'rejected',
  });
  const latestEvalStatus = deriveEvalStatus(evalRun, store, {
    ...workflowRun,
    artifacts: nextArtifacts,
  });
  const nextWorkflowRun = {
    ...workflowRun,
    artifacts: nextArtifacts,
    latestEvalRunId: evalRun.id,
    latestEvalStatus,
    latestEvalAt: evalRun.evaluatedAt,
    updatedAt: new Date().toISOString(),
  };

  schemaRegistry.assertValid('contracts/workflow-run.schema.json', nextWorkflowRun);
  store.saveWorkflowRun(nextWorkflowRun);

  console.log(JSON.stringify({
    evalRunId: evalRun.id,
    latestEvalStatus,
    runId: workflowRun.id,
    summary: evalRun.summary,
  }, null, 2));
} finally {
  store.close();
}
