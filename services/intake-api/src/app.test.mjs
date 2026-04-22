import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
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
 * @param {{ dbFilePath: string, objectStoreDir: string }} options
 * @returns {Promise<{ baseUrl: string, close: () => Promise<void>, store: any }>}
 */
async function startServer(options) {
  const app = await createApp({
    dbFilePath: options.dbFilePath,
    objectStoreDir: options.objectStoreDir,
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
    assert.match(reviewPage, /Local Review Dashboard/);
    assert.match(reviewPage, /Open local mode/);

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

    const reviewResponse = await fetch(`${app.baseUrl}/review/runs/${encodeURIComponent(workflowRun.id)}`);
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

    const reviewResponse = await fetch(`${app.baseUrl}/review/runs/${encodeURIComponent(workflowRun.id)}`);
    assert.equal(reviewResponse.status, 200);
    const reviewPage = await reviewResponse.text();
    assert.match(reviewPage, new RegExp(evaluationPayload.evaluation.id));
    assert.match(reviewPage, /release-bundles/);
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
