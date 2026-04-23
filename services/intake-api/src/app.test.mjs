import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createApp } from './app.mjs';

/**
 * @returns {Promise<{ dbFilePath: string, objectStoreDir: string, cleanup: () => Promise<void> }>}
 */
async function createSandbox() {
  const directory = await mkdtemp(path.join(tmpdir(), 'mms-intake-api-'));

  return {
    dbFilePath: path.join(directory, 'platform.sqlite'),
    objectStoreDir: path.join(directory, 'object-store'),
    cleanup: async () => {
      await rm(directory, { force: true, recursive: true });
    },
  };
}

/**
 * @param {{ dbFilePath: string, objectStoreDir: string, webDistDir?: string }} options
 * @returns {Promise<{ baseUrl: string, close: () => Promise<void>, store: any }>}
 */
async function startServer(options) {
  const app = await createApp({
    dbFilePath: options.dbFilePath,
    objectStoreDir: options.objectStoreDir,
    webDistDir: options.webDistDir,
  });

  await new Promise((resolve) => {
    app.server.listen(0, '127.0.0.1', () => resolve(undefined));
  });

  const address = app.server.address();

  if (!address || typeof address === 'string') {
    throw new Error('Unable to determine starter API address.');
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    store: app.store,
    close: async () => {
      await new Promise((resolve, reject) => {
        app.server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(undefined);
        });
      });
      app.store.close();
    },
  };
}

/**
 * @param {string} directory
 * @returns {Promise<void>}
 */
async function writeFakeWebDist(directory) {
  await mkdir(path.join(directory, 'assets'), { recursive: true });
  await writeFile(path.join(directory, 'index.html'), '<!doctype html><html><body><div id="root">web-shell</div></body></html>');
  await writeFile(path.join(directory, 'assets', 'app.js'), 'console.log("web-shell")');
}

/**
 * @param {string} baseUrl
 * @param {Record<string, unknown>} payload
 * @returns {Promise<any>}
 */
async function createProject(baseUrl, payload) {
  const response = await fetch(`${baseUrl}/api/v1/projects`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  assert.equal(response.status, 201);
  return response.json();
}

/**
 * @param {string} baseUrl
 * @param {string} projectId
 * @param {Record<string, unknown>} [overrides]
 * @returns {Promise<any>}
 */
async function startWorkflowRun(baseUrl, projectId, overrides = {}) {
  const response = await fetch(`${baseUrl}/api/v1/workflow-runs`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      projectId,
      ...overrides,
    }),
  });

  assert.equal(response.status, 202);
  return response.json();
}

/**
 * @param {string} baseUrl
 * @param {string} runId
 * @param {string} role
 * @param {'approved' | 'rejected'} [decision]
 * @returns {Promise<any>}
 */
async function submitApproval(baseUrl, runId, role, decision = 'approved') {
  const response = await fetch(`${baseUrl}/api/v1/workflow-runs/${encodeURIComponent(runId)}/approvals`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      role,
      decision,
      comment: `${role} ${decision} in local review.`,
    }),
  });

  assert.equal(response.status, 200);
  return response.json();
}

test('local review pages load without sign-in and auth routes are gone', async () => {
  const sandbox = await createSandbox();
  const app = await startServer(sandbox);

  try {
    const reviewResponse = await fetch(`${app.baseUrl}/review`);
    assert.equal(reviewResponse.status, 200);
    const reviewPage = await reviewResponse.text();
    assert.match(reviewPage, /<div id="root"><\/div>/);
    assert.match(reviewPage, /Disease Comic Platform/);

    const debugReviewResponse = await fetch(`${app.baseUrl}/debug/review`);
    assert.equal(debugReviewResponse.status, 200);
    const debugReviewPage = await debugReviewResponse.text();
    assert.match(debugReviewPage, /Local Review Dashboard/);
    assert.match(debugReviewPage, /Open local mode/);

    const signInResponse = await fetch(`${app.baseUrl}/signin`);
    assert.equal(signInResponse.status, 404);

    const authResponse = await fetch(`${app.baseUrl}/api/v1/auth/me`);
    assert.equal(authResponse.status, 404);
  } finally {
    await app.close();
    await sandbox.cleanup();
  }
});

test('create project stores local tenant ownership', async () => {
  const sandbox = await createSandbox();
  const app = await startServer(sandbox);

  try {
    const project = await createProject(app.baseUrl, {
      diseaseName: 'hepatocellular carcinoma',
      audienceTier: 'provider-education',
      lengthProfile: 'standard-issue',
      qualityProfile: 'pilot',
      styleProfile: 'whimsical-mystery',
    });

    assert.equal(project.tenantId, 'tenant.local');
    assert.equal(project.input.qualityProfile, 'pilot');
  } finally {
    await app.close();
    await sandbox.cleanup();
  }
});

test('starting a workflow run renders local review actions and artifact groups', async () => {
  const sandbox = await createSandbox();
  const app = await startServer(sandbox);

  try {
    const project = await createProject(app.baseUrl, {
      diseaseName: 'community-acquired pneumonia',
    });
    const workflowRun = await startWorkflowRun(app.baseUrl, project.id);

    assert.equal(workflowRun.state, 'review');
    assert.equal(workflowRun.currentStage, 'review');
    assert.equal(workflowRun.tenantId, 'tenant.local');
    assert.equal(workflowRun.artifacts.some((/** @type {{ artifactType: string }} */ artifact) => artifact.artifactType === 'render-prompt'), true);

    const reviewResponse = await fetch(`${app.baseUrl}/debug/review/runs/${encodeURIComponent(workflowRun.id)}`);
    assert.equal(reviewResponse.status, 200);
    const reviewPage = await reviewResponse.text();
    assert.match(reviewPage, /Run evaluations/);
    assert.match(reviewPage, /Export bundle/);
    assert.match(reviewPage, /Story workbook and narrative review trace/);
    assert.match(reviewPage, /Governed source records/);
  } finally {
    await app.close();
    await sandbox.cleanup();
  }
});

test('review comments and assignments persist into read models and dashboard filters', async () => {
  const sandbox = await createSandbox();
  const app = await startServer(sandbox);

  try {
    const project = await createProject(app.baseUrl, {
      diseaseName: 'community-acquired pneumonia',
    });
    const workflowRun = await startWorkflowRun(app.baseUrl, project.id);

    const assignmentResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs/${encodeURIComponent(workflowRun.id)}/assignments`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        reviewRole: 'clinical',
        assigneeDisplayName: 'Local Operator',
        status: 'in-progress',
        notes: 'Validate the clue ladder against the disease packet evidence set.',
      }),
    });
    assert.equal(assignmentResponse.status, 201);

    const commentResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs/${encodeURIComponent(workflowRun.id)}/comments`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        scopeType: 'artifact',
        artifactType: 'panel-plan',
        severity: 'warning',
        body: 'Opening panel should link more clearly to the source-backed respiratory clue.',
      }),
    });
    assert.equal(commentResponse.status, 201);

    const reviewRunViewResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs/${encodeURIComponent(workflowRun.id)}/review-run-view`);
    assert.equal(reviewRunViewResponse.status, 200);
    const reviewRunView = await reviewRunViewResponse.json();

    assert.equal(reviewRunView.reviewAssignments.length, 1);
    assert.equal(reviewRunView.reviewAssignments[0].assigneeDisplayName, 'Local Operator');
    assert.equal(reviewRunView.reviewComments.length, 1);
    assert.equal(reviewRunView.reviewComments[0].artifactType, 'panel-plan');

    const filteredDashboardResponse = await fetch(`${app.baseUrl}/api/v1/review-dashboard-view?assignee=local`);
    assert.equal(filteredDashboardResponse.status, 200);
    const filteredDashboard = await filteredDashboardResponse.json();

    assert.equal(filteredDashboard.runs.length, 1);
    assert.deepEqual(filteredDashboard.runs[0].assignees, ['Local Operator']);
    assert.equal(filteredDashboard.runs[0].openCommentCount, 1);
  } finally {
    await app.close();
    await sandbox.cleanup();
  }
});

test('canonicalization can be resolved from the local review page', async () => {
  const sandbox = await createSandbox();
  const app = await startServer(sandbox);

  try {
    const project = await createProject(app.baseUrl, {
      diseaseName: 'MG',
    });
    const workflowRun = await startWorkflowRun(app.baseUrl, project.id);

    assert.equal(workflowRun.state, 'failed');
    assert.equal(workflowRun.currentStage, 'canonicalization');

    const resolutionResponse = await fetch(`${app.baseUrl}/review/runs/${encodeURIComponent(workflowRun.id)}/canonicalization-resolution`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        selectedCanonicalDiseaseName: 'Myasthenia gravis',
        reason: 'Local reviewer confirmed the intended disease.',
      }),
      redirect: 'manual',
    });

    assert.equal(resolutionResponse.status, 303);

    const updatedRunResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs/${encodeURIComponent(workflowRun.id)}`);
    assert.equal(updatedRunResponse.status, 200);
    const updatedRun = await updatedRunResponse.json();

    assert.equal(updatedRun.state, 'review');
    assert.equal(updatedRun.currentStage, 'review');
    assert.equal(updatedRun.artifacts.some((/** @type {{ artifactType: string }} */ artifact) => artifact.artifactType === 'disease-packet'), true);
  } finally {
    await app.close();
    await sandbox.cleanup();
  }
});

test('artifact diff endpoint compares stored versions for the same run', async () => {
  const sandbox = await createSandbox();
  const app = await startServer(sandbox);

  try {
    const project = await createProject(app.baseUrl, {
      diseaseName: 'MG',
    });
    const workflowRun = await startWorkflowRun(app.baseUrl, project.id);

    const resolutionResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs/${encodeURIComponent(workflowRun.id)}/canonicalization-resolution`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        selectedCanonicalDiseaseName: 'Myasthenia gravis',
        reason: 'Local reviewer confirmed the intended disease.',
      }),
    });
    assert.equal(resolutionResponse.status, 200);

    const diffResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs/${encodeURIComponent(workflowRun.id)}/artifact-diffs?artifactType=canonical-disease`);
    assert.equal(diffResponse.status, 200);
    const diffView = await diffResponse.json();

    assert.equal(diffView.comparisonStatus, 'diff-available');
    assert.equal(diffView.artifactType, 'canonical-disease');
    assert.equal(diffView.summary.changeCount > 0, true);
    assert.equal(diffView.availableArtifacts.length >= 2, true);
  } finally {
    await app.close();
    await sandbox.cleanup();
  }
});

test('clinical governance can pause a run before story generation and expose the clinical package', async () => {
  const sandbox = await createSandbox();
  const app = await startServer(sandbox);

  try {
    const project = await createProject(app.baseUrl, {
      diseaseName: 'bacterial meningitis',
    });
    const workflowRun = await startWorkflowRun(app.baseUrl, project.id);

    assert.equal(workflowRun.state, 'review');
    assert.equal(workflowRun.currentStage, 'disease-packet');
    assert.equal(workflowRun.pauseReason, 'clinical-governance-review-required');
    assert.equal(workflowRun.artifacts.some((/** @type {any} */ artifact) => artifact.artifactType === 'story-workbook'), false);

    const clinicalPackageResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs/${encodeURIComponent(workflowRun.id)}/clinical-package`);
    assert.equal(clinicalPackageResponse.status, 200);
    const clinicalPackage = await clinicalPackageResponse.json();

    assert.equal(clinicalPackage.diseasePacket.canonicalDiseaseName, 'Bacterial meningitis');
    assert.equal(clinicalPackage.evidenceRelationships.some((/** @type {any} */ relationship) => relationship.relationshipType === 'contradicts'), true);
  } finally {
    await app.close();
    await sandbox.cleanup();
  }
});

test('contradiction resolution plus rebuild regenerates downstream artifacts', async () => {
  const sandbox = await createSandbox();
  const app = await startServer(sandbox);

  try {
    const project = await createProject(app.baseUrl, {
      diseaseName: 'bacterial meningitis',
    });
    let workflowRun = await startWorkflowRun(app.baseUrl, project.id);
    const clinicalPackageResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs/${encodeURIComponent(workflowRun.id)}/clinical-package`);
    const clinicalPackage = await clinicalPackageResponse.json();
    const contradictionEdge = clinicalPackage.evidenceRelationships.find((/** @type {any} */ relationship) => relationship.relationshipType === 'contradicts');

    assert.ok(contradictionEdge);

    const resolutionResponse = await fetch(`${app.baseUrl}/api/v1/evidence-records/${encodeURIComponent(contradictionEdge.fromClaimId)}/contradiction-resolutions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        canonicalDiseaseName: 'Bacterial meningitis',
        relatedClaimId: contradictionEdge.toClaimId,
        status: 'resolved',
        reason: 'Local reviewer resolved the starter contradiction for this run.',
      }),
    });
    assert.equal(resolutionResponse.status, 201);

    const rebuildResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs/${encodeURIComponent(workflowRun.id)}/clinical-package/rebuild`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        reason: 'Resume downstream story generation after contradiction review.',
      }),
    });
    assert.equal(rebuildResponse.status, 200);
    workflowRun = await rebuildResponse.json();

    assert.equal(workflowRun.pauseReason ?? null, null);
    assert.equal(workflowRun.state, 'review');
    assert.equal(workflowRun.currentStage, 'review');
    assert.equal(workflowRun.artifacts.some((/** @type {any} */ artifact) => artifact.artifactType === 'story-workbook'), true);
  } finally {
    await app.close();
    await sandbox.cleanup();
  }
});

test('evaluations persist, appear in the review UI, and gate export', async () => {
  const sandbox = await createSandbox();
  const app = await startServer(sandbox);

  try {
    const project = await createProject(app.baseUrl, {
      diseaseName: 'community-acquired pneumonia',
    });
    let workflowRun = await startWorkflowRun(app.baseUrl, project.id);

    workflowRun = await submitApproval(app.baseUrl, workflowRun.id, 'clinical');
    workflowRun = await submitApproval(app.baseUrl, workflowRun.id, 'editorial');
    workflowRun = await submitApproval(app.baseUrl, workflowRun.id, 'product');
    assert.equal(workflowRun.state, 'approved');

    const blockedExportResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs/${encodeURIComponent(workflowRun.id)}/exports`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ version: 'cap-local-1' }),
    });
    assert.equal(blockedExportResponse.status, 409);
    const blockedExportPayload = await blockedExportResponse.json();
    assert.match(blockedExportPayload.error, /eval run/i);

    const evaluationResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs/${encodeURIComponent(workflowRun.id)}/evaluations`, {
      method: 'POST',
    });
    assert.equal(evaluationResponse.status, 201);
    const evaluationPayload = await evaluationResponse.json();

    assert.equal(evaluationPayload.workflowRun.latestEvalStatus, 'passed');
    assert.equal(evaluationPayload.evaluation.summary.allThresholdsMet, true);

    const evaluationListResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs/${encodeURIComponent(workflowRun.id)}/evaluations`);
    assert.equal(evaluationListResponse.status, 200);
    const evalRuns = await evaluationListResponse.json();
    assert.equal(evalRuns.length, 1);

    const evalRunResponse = await fetch(`${app.baseUrl}/api/v1/evaluations/${encodeURIComponent(evaluationPayload.evaluation.id)}`);
    assert.equal(evalRunResponse.status, 200);
    const evalRun = await evalRunResponse.json();
    assert.equal(evalRun.id, evaluationPayload.evaluation.id);

    const exportResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs/${encodeURIComponent(workflowRun.id)}/exports`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ version: 'cap-local-1' }),
    });
    assert.equal(exportResponse.status, 201);
    const exportPayload = await exportResponse.json();

    assert.equal(exportPayload.releaseBundle.evaluationSummary.evalRunId, evaluationPayload.evaluation.id);
    assert.equal(exportPayload.exportHistoryEntry.evalRunId, evaluationPayload.evaluation.id);

    const reviewRunViewResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs/${encodeURIComponent(workflowRun.id)}/review-run-view`);
    assert.equal(reviewRunViewResponse.status, 200);
    const reviewRunView = await reviewRunViewResponse.json();

    assert.equal(reviewRunView.evaluationSummary.latestEvalRunId, evaluationPayload.evaluation.id);
    assert.equal(reviewRunView.exportHistory.entries.length, 1);
    assert.equal(reviewRunView.exportHistory.entries[0].releaseId, exportPayload.releaseBundle.releaseId);
  } finally {
    await app.close();
    await sandbox.cleanup();
  }
});

test('traceability failures block export after downstream artifacts drift', async () => {
  const sandbox = await createSandbox();
  const app = await startServer(sandbox);

  try {
    const project = await createProject(app.baseUrl, {
      diseaseName: 'community-acquired pneumonia',
    });
    let workflowRun = await startWorkflowRun(app.baseUrl, project.id);

    workflowRun = await submitApproval(app.baseUrl, workflowRun.id, 'clinical');
    workflowRun = await submitApproval(app.baseUrl, workflowRun.id, 'editorial');
    workflowRun = await submitApproval(app.baseUrl, workflowRun.id, 'product');

    for (const renderPromptReference of workflowRun.artifacts.filter((/** @type {any} */ artifact) => artifact.artifactType === 'render-prompt')) {
      const renderPrompt = app.store.getArtifact('render-prompt', renderPromptReference.artifactId);
      renderPrompt.linkedClaimIds = [];
      app.store.saveArtifact('render-prompt', renderPrompt.id, renderPrompt, {
        tenantId: workflowRun.tenantId,
      });
    }

    const evaluationResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs/${encodeURIComponent(workflowRun.id)}/evaluations`, {
      method: 'POST',
    });
    assert.equal(evaluationResponse.status, 201);
    const evaluationPayload = await evaluationResponse.json();

    assert.equal(evaluationPayload.evaluation.summary.allThresholdsMet, false);
    assert.equal(evaluationPayload.evaluation.summary.familyScores.evidence_traceability < 0.95, true);

    const exportResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs/${encodeURIComponent(workflowRun.id)}/exports`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ version: 'cap-local-trace-fail' }),
    });
    assert.equal(exportResponse.status, 409);
    const exportPayload = await exportResponse.json();
    assert.match(exportPayload.error, /latest eval run/i);
  } finally {
    await app.close();
    await sandbox.cleanup();
  }
});

test('workflow runs and eval state persist across restart', async () => {
  const sandbox = await createSandbox();
  const app = await startServer(sandbox);

  try {
    const project = await createProject(app.baseUrl, {
      diseaseName: 'hepatocellular carcinoma',
    });
    let workflowRun = await startWorkflowRun(app.baseUrl, project.id);
    workflowRun = await submitApproval(app.baseUrl, workflowRun.id, 'clinical');
    workflowRun = await submitApproval(app.baseUrl, workflowRun.id, 'editorial');
    workflowRun = await submitApproval(app.baseUrl, workflowRun.id, 'product');
    const evaluationResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs/${encodeURIComponent(workflowRun.id)}/evaluations`, {
      method: 'POST',
    });
    assert.equal(evaluationResponse.status, 201);
    const evaluationPayload = await evaluationResponse.json();
    const evalRunId = evaluationPayload.evaluation.id;

    await app.close();

    const restartedApp = await startServer(sandbox);

    try {
      const workflowRunResponse = await fetch(`${restartedApp.baseUrl}/api/v1/workflow-runs/${encodeURIComponent(workflowRun.id)}`);
      assert.equal(workflowRunResponse.status, 200);
      const persistedRun = await workflowRunResponse.json();
      assert.equal(persistedRun.latestEvalRunId, evalRunId);
      assert.equal(persistedRun.latestEvalStatus, 'passed');

      const evaluationListResponse = await fetch(`${restartedApp.baseUrl}/api/v1/workflow-runs/${encodeURIComponent(workflowRun.id)}/evaluations`);
      assert.equal(evaluationListResponse.status, 200);
      const evalRuns = await evaluationListResponse.json();
      assert.equal(evalRuns.length, 1);
      assert.equal(evalRuns[0].id, evalRunId);
    } finally {
      await restartedApp.close();
    }
  } finally {
    await sandbox.cleanup();
  }
});

test('dashboard, review run, artifact list, and local runtime API views return the expected data', async () => {
  const sandbox = await createSandbox();
  const app = await startServer(sandbox);

  try {
    const project = await createProject(app.baseUrl, {
      diseaseName: 'community-acquired pneumonia',
    });
    const workflowRun = await startWorkflowRun(app.baseUrl, project.id);

    const dashboardResponse = await fetch(`${app.baseUrl}/api/v1/review-dashboard-view`);
    assert.equal(dashboardResponse.status, 200);
    const dashboardView = await dashboardResponse.json();
    assert.equal(dashboardView.title, 'Local Review Dashboard');
    assert.equal(dashboardView.runs.some((/** @type {any} */ run) => run.runId === workflowRun.id), true);

    const reviewRunResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs/${encodeURIComponent(workflowRun.id)}/review-run-view`);
    assert.equal(reviewRunResponse.status, 200);
    const reviewRunView = await reviewRunResponse.json();
    assert.equal(reviewRunView.runId, workflowRun.id);
    assert.equal(reviewRunView.clinicalPackage.diseasePacket.canonicalDiseaseName, 'Community-acquired pneumonia');

    const artifactListResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs/${encodeURIComponent(workflowRun.id)}/artifacts?artifactType=story-workbook,panel-plan&expand=true`);
    assert.equal(artifactListResponse.status, 200);
    const artifactListView = await artifactListResponse.json();
    assert.equal(artifactListView.expand, true);
    assert.equal(artifactListView.artifacts.some((/** @type {any} */ artifact) => artifact.artifactType === 'story-workbook' && artifact.payload), true);
    assert.equal(artifactListView.artifacts.some((/** @type {any} */ artifact) => artifact.artifactType === 'panel-plan' && artifact.payload), true);

    const localRuntimeResponse = await fetch(`${app.baseUrl}/api/v1/local-runtime-view`);
    assert.equal(localRuntimeResponse.status, 200);
    const localRuntimeView = await localRuntimeResponse.json();
    assert.equal(localRuntimeView.actor.id, 'local-operator');
    assert.equal(localRuntimeView.tenantId, 'tenant.local');
    assert.equal(localRuntimeView.availableCommands.includes('pnpm dev:web'), true);
  } finally {
    await app.close();
    await sandbox.cleanup();
  }
});

test('built web assets are served while debug pages remain available', async () => {
  const sandbox = await createSandbox();
  const webDistDir = path.join(path.dirname(sandbox.dbFilePath), 'web-dist');
  await writeFakeWebDist(webDistDir);
  const app = await startServer({
    ...sandbox,
    webDistDir,
  });

  try {
    const reviewResponse = await fetch(`${app.baseUrl}/review`, {
      redirect: 'manual',
    });
    assert.equal(reviewResponse.status, 200);
    const reviewPage = await reviewResponse.text();
    assert.match(reviewPage, /web-shell/);

    const assetResponse = await fetch(`${app.baseUrl}/assets/app.js`);
    assert.equal(assetResponse.status, 200);
    const assetContents = await assetResponse.text();
    assert.match(assetContents, /web-shell/);

    const legacyReviewResponse = await fetch(`${app.baseUrl}/review/runs/run.example.001`, {
      redirect: 'manual',
    });
    assert.equal(legacyReviewResponse.status, 302);
    assert.equal(legacyReviewResponse.headers.get('location'), '/runs/run.example.001/review');

    const debugReviewResponse = await fetch(`${app.baseUrl}/debug/review`);
    assert.equal(debugReviewResponse.status, 200);
    const debugReviewPage = await debugReviewResponse.text();
    assert.match(debugReviewPage, /Local Review Dashboard/);
  } finally {
    await app.close();
    await sandbox.cleanup();
  }
});

test('review queue, threaded review, source ownership, refresh tasks, and render jobs work through the public API', async () => {
  const sandbox = await createSandbox();
  const app = await startServer(sandbox);

  try {
    const project = await createProject(app.baseUrl, {
      diseaseName: 'community-acquired pneumonia',
    });
    const workflowRun = await startWorkflowRun(app.baseUrl, project.id);

    const threadResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs/${encodeURIComponent(workflowRun.id)}/threads`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Clinical governance follow-up',
        scopeType: 'run',
      }),
    });
    assert.equal(threadResponse.status, 201);
    const reviewThread = await threadResponse.json();

    const messageResponse = await fetch(`${app.baseUrl}/api/v1/review-threads/${encodeURIComponent(reviewThread.id)}/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        body: 'Need a quick review of source freshness and render readiness.',
      }),
    });
    assert.equal(messageResponse.status, 201);
    const reviewMessage = await messageResponse.json();
    assert.equal(reviewMessage.threadId, reviewThread.id);

    const threadsListResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs/${encodeURIComponent(workflowRun.id)}/threads`);
    assert.equal(threadsListResponse.status, 200);
    const reviewThreads = await threadsListResponse.json();
    assert.equal(reviewThreads.length >= 1, true);
    assert.equal(reviewThreads[0].messages.length >= 1, true);

    const sourceCatalogResponse = await fetch(`${app.baseUrl}/api/v1/source-catalog`);
    assert.equal(sourceCatalogResponse.status, 200);
    const sourceCatalog = await sourceCatalogResponse.json();
    const sourceRecord = sourceCatalog.find((/** @type {any} */ record) => record.canonicalDiseaseName === 'Community-acquired pneumonia');
    assert.equal(Boolean(sourceRecord), true);

    const ownershipResponse = await fetch(`${app.baseUrl}/api/v1/source-catalog/${encodeURIComponent(sourceRecord.id)}/ownership`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        canonicalDiseaseName: sourceRecord.canonicalDiseaseName,
        primaryOwnerRole: 'Clinical Reviewer',
        backupOwnerRole: 'Product Editor',
        notes: ['Assigned during API integration coverage.'],
      }),
    });
    assert.equal(ownershipResponse.status, 201);
    const ownership = await ownershipResponse.json();
    assert.equal(ownership.sourceId, sourceRecord.id);

    const refreshTaskResponse = await fetch(`${app.baseUrl}/api/v1/source-catalog/${encodeURIComponent(sourceRecord.id)}/refresh-tasks`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        canonicalDiseaseName: sourceRecord.canonicalDiseaseName,
        workflowRunId: workflowRun.id,
        reason: 'Test-created refresh task.',
      }),
    });
    assert.equal(refreshTaskResponse.status, 201);
    const refreshTask = await refreshTaskResponse.json();
    assert.equal(refreshTask.sourceId, sourceRecord.id);
    assert.equal(typeof refreshTask.workItemId, 'string');

    const queueResponse = await fetch(`${app.baseUrl}/api/v1/review-queue?workType=source-refresh`);
    assert.equal(queueResponse.status, 200);
    const queueView = await queueResponse.json();
    assert.equal(queueView.items.some((/** @type {any} */ item) => item.workItemId === refreshTask.workItemId), true);

    const workItemResponse = await fetch(`${app.baseUrl}/api/v1/work-items/${encodeURIComponent(refreshTask.workItemId)}`);
    assert.equal(workItemResponse.status, 200);
    const workItem = await workItemResponse.json();
    assert.equal(workItem.workType, 'source-refresh');

    const updatedWorkItemResponse = await fetch(`${app.baseUrl}/api/v1/work-items/${encodeURIComponent(refreshTask.workItemId)}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        status: 'completed',
        notes: ['Completed during API integration coverage.'],
      }),
    });
    assert.equal(updatedWorkItemResponse.status, 200);
    const updatedWorkItem = await updatedWorkItemResponse.json();
    assert.equal(updatedWorkItem.status, 'completed');

    const renderJobResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs/${encodeURIComponent(workflowRun.id)}/render-jobs`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    assert.equal(renderJobResponse.status, 202);
    const renderJobPayload = await renderJobResponse.json();
    assert.equal(renderJobPayload.renderJob.workflowRunId, workflowRun.id);

    const renderJobDetailResponse = await fetch(`${app.baseUrl}/api/v1/render-jobs/${encodeURIComponent(renderJobPayload.renderJob.id)}`);
    assert.equal(renderJobDetailResponse.status, 200);
    const renderJobDetail = await renderJobDetailResponse.json();
    assert.equal(Array.isArray(renderJobDetail.attempts), true);
    assert.equal(Array.isArray(renderJobDetail.renderedAssets), true);
  } finally {
    await app.close();
    await sandbox.cleanup();
  }
});
