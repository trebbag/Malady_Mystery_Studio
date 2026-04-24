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
 * @param {{ dbFilePath: string, objectStoreDir: string, webDistDir?: string, researchAssemblyService?: any, openaiApiKey?: string, renderProvider?: string, renderProviderApiKey?: string }} options
 * @returns {Promise<{ baseUrl: string, close: () => Promise<void>, store: any }>}
 */
async function startServer(options) {
  const app = await createApp({
    dbFilePath: options.dbFilePath,
    objectStoreDir: options.objectStoreDir,
    webDistDir: options.webDistDir,
    researchAssemblyService: options.researchAssemblyService,
    openaiApiKey: options.openaiApiKey,
    renderProvider: options.renderProvider,
    renderProviderApiKey: options.renderProviderApiKey,
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

      const closeAsync = /** @type {any} */ (app.store).closeAsync;

      if (typeof closeAsync === 'function') {
        await closeAsync.call(app.store);
      } else {
        app.store.close();
      }
    },
  };
}

test('createApp keeps SQLite active even when managed metadata env vars are present', async () => {
  const sandbox = await createSandbox();
  const previousMetadataStoreBackend = process.env.METADATA_STORE_BACKEND;
  const previousLocalStorageOnly = process.env.LOCAL_STORAGE_ONLY;

  process.env.METADATA_STORE_BACKEND = 'postgres';
  process.env.LOCAL_STORAGE_ONLY = '0';

  try {
    const app = await createApp({
        dbFilePath: sandbox.dbFilePath,
        objectStoreDir: sandbox.objectStoreDir,
        localStorageOnly: false,
      });

    assert.equal(app.store.dbFilePath, sandbox.dbFilePath);
    app.store.close();
  } finally {
    if (previousMetadataStoreBackend === undefined) {
      delete process.env.METADATA_STORE_BACKEND;
    } else {
      process.env.METADATA_STORE_BACKEND = previousMetadataStoreBackend;
    }

    if (previousLocalStorageOnly === undefined) {
      delete process.env.LOCAL_STORAGE_ONLY;
    } else {
      process.env.LOCAL_STORAGE_ONLY = previousLocalStorageOnly;
    }

    await sandbox.cleanup();
  }
});

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

  assert.equal(response.status, 202, await response.clone().text());
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

/**
 * @param {string} baseUrl
 * @param {string} runId
 * @returns {Promise<any>}
 */
async function approveRenderingGuide(baseUrl, runId) {
  const response = await fetch(`${baseUrl}/api/v1/workflow-runs/${encodeURIComponent(runId)}/rendering-guide/review-decisions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      decision: 'approved',
      comment: 'Local reviewer approved the full rendering guide and visual reference pack.',
    }),
  });

  assert.equal(response.status, 201, await response.clone().text());
  const payload = await response.json();
  assert.equal(payload.gateStatus, 'approved');
  return payload;
}

/**
 * @param {string} baseUrl
 * @param {string} runId
 * @returns {Promise<any>}
 */
async function queueRenderJob(baseUrl, runId) {
  const response = await fetch(`${baseUrl}/api/v1/workflow-runs/${encodeURIComponent(runId)}/render-jobs`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  assert.equal(response.status, 202, await response.clone().text());
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
    assert.equal(workflowRun.currentStage, 'render-prep');
    assert.equal(workflowRun.pauseReason, 'render-guide-review-required');
    assert.equal(workflowRun.tenantId, 'tenant.local');
    assert.equal(workflowRun.artifacts.some((/** @type {{ artifactType: string }} */ artifact) => artifact.artifactType === 'render-prompt'), true);
    assert.equal(workflowRun.artifacts.some((/** @type {{ artifactType: string }} */ artifact) => artifact.artifactType === 'rendering-guide'), true);
    assert.equal(workflowRun.artifacts.some((/** @type {{ artifactType: string }} */ artifact) => artifact.artifactType === 'visual-reference-pack'), true);

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
    assert.equal(updatedRun.currentStage, 'render-prep');
    assert.equal(updatedRun.pauseReason, 'render-guide-review-required');
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

    assert.equal(workflowRun.pauseReason, 'render-guide-review-required');
    assert.equal(workflowRun.state, 'review');
    assert.equal(workflowRun.currentStage, 'render-prep');
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

    await approveRenderingGuide(app.baseUrl, workflowRun.id);
    const renderJobPayload = await queueRenderJob(app.baseUrl, workflowRun.id);
    assert.ok(renderJobPayload.renderJob.renderingGuideId);
    assert.ok(renderJobPayload.renderJob.visualReferencePackId);

    const postRenderRunResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs/${encodeURIComponent(workflowRun.id)}`);
    workflowRun = await postRenderRunResponse.json();
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
    assert.equal(evaluationPayload.evaluation.validationMode, 'local-structural');
    assert.equal(evaluationPayload.evaluation.summary.allThresholdsMet, true);
    assert.equal(evaluationPayload.evaluation.summary.structuralRenderOutputOnly, true);
    assert.equal(evaluationPayload.evaluation.summary.familyScores.render_output_quality, 1);
    const renderOutputFamily = evaluationPayload.evaluation.familyResults.find((/** @type {any} */ family) => family.family === 'render_output_quality');
    assert.equal(renderOutputFamily.status, 'passed');
    assert.match(renderOutputFamily.cases[0].message, /does not certify final image quality/u);

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
    assert.ok(exportPayload.releaseBundle.renderedAssetManifestId);

    const mirrorResponse = await fetch(`${app.baseUrl}/api/v1/release-bundles/${encodeURIComponent(exportPayload.releaseBundle.releaseId)}/mirror-local`, {
      method: 'POST',
    });
    assert.equal(mirrorResponse.status, 201, await mirrorResponse.clone().text());
    const mirror = await mirrorResponse.json();
    assert.equal(mirror.releaseId, exportPayload.releaseBundle.releaseId);

    const verifyMirrorResponse = await fetch(`${app.baseUrl}/api/v1/release-bundles/${encodeURIComponent(exportPayload.releaseBundle.releaseId)}/verify-local-mirror`, {
      method: 'POST',
    });
    assert.equal(verifyMirrorResponse.status, 201, await verifyMirrorResponse.clone().text());
    const mirrorVerification = await verifyMirrorResponse.json();
    assert.equal(mirrorVerification.status, 'passed');
    assert.equal(mirrorVerification.localDeliveryMirrorId, mirror.id);

    const reviewRunViewResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs/${encodeURIComponent(workflowRun.id)}/review-run-view`);
    assert.equal(reviewRunViewResponse.status, 200);
    const reviewRunView = await reviewRunViewResponse.json();

    assert.equal(reviewRunView.evaluationSummary.latestEvalRunId, evaluationPayload.evaluation.id);
    assert.equal(reviewRunView.exportHistory.entries.length, 1);
    assert.equal(reviewRunView.exportHistory.entries[0].releaseId, exportPayload.releaseBundle.releaseId);

    const restoreSmokeResponse = await fetch(`${app.baseUrl}/api/v1/local-ops/restore-smoke`, {
      method: 'POST',
    });
    assert.equal(restoreSmokeResponse.status, 201, await restoreSmokeResponse.clone().text());
    const restoreSmoke = await restoreSmokeResponse.json();
    assert.equal(restoreSmoke.stats.missingObjectReferenceCount, 0);
    assert.equal(restoreSmoke.stats.schemaValidationFailureCount, 0);
    assert.equal(restoreSmoke.stats.deliveryVerificationCount >= 1, true);
  } finally {
    await app.close();
    await sandbox.cleanup();
  }
});

test('rendering guide endpoints and manual rendered-asset attachment remain available as a secondary path', async () => {
  const sandbox = await createSandbox();
  const app = await startServer(sandbox);

  try {
    const project = await createProject(app.baseUrl, {
      diseaseName: 'community-acquired pneumonia',
    });
    const workflowRun = await startWorkflowRun(app.baseUrl, project.id);

    const renderingGuideResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs/${encodeURIComponent(workflowRun.id)}/rendering-guide`);
    assert.equal(renderingGuideResponse.status, 200);
    const renderingGuideView = await renderingGuideResponse.json();

    assert.equal(renderingGuideView.runId, workflowRun.id);
    assert.equal(renderingGuideView.gateStatus, 'not-reviewed');
    assert.equal(renderingGuideView.attachmentSummary.attachmentMode, 'guide-only');

    const blockedRenderResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs/${encodeURIComponent(workflowRun.id)}/render-jobs`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    assert.equal(blockedRenderResponse.status, 409);
    const blockedRenderPayload = await blockedRenderResponse.json();
    assert.match(blockedRenderPayload.error, /reviewed and approved/i);

    await approveRenderingGuide(app.baseUrl, workflowRun.id);

    const attachmentResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs/${encodeURIComponent(workflowRun.id)}/rendered-assets/attach`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        assets: [
          {
            panelId: renderingGuideView.renderingGuide.panels[0].panelId,
            location: 'external-renders/cap/panel-01.png',
            mimeType: 'image/png',
            checksum: 'manual-rendered-checksum-01',
            width: 2048,
            height: 1536,
          },
        ],
      }),
    });
    assert.equal(attachmentResponse.status, 201);
    const attachedGuideView = await attachmentResponse.json();

    assert.equal(attachedGuideView.attachmentSummary.attachmentMode, 'external-art-attached');
    assert.equal(attachedGuideView.attachmentSummary.attachedRenderedAssetCount, 1);

    const refreshedRunResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs/${encodeURIComponent(workflowRun.id)}`);
    const refreshedRun = await refreshedRunResponse.json();
    assert.equal(refreshedRun.artifacts.some((/** @type {any} */ artifact) => artifact.artifactType === 'rendered-asset-manifest'), true);
  } finally {
    await app.close();
    await sandbox.cleanup();
  }
});

test('free-text disease input can compile through agent research into a provisional knowledge pack', async () => {
  const sandbox = await createSandbox();
  const app = await startServer({
    ...sandbox,
    researchAssemblyService: {
      async compileProvisionalKnowledgePack(/** @type {{ workflowRun: any, workflowInput: any, canonicalDisease: any }} */ { workflowRun, workflowInput, canonicalDisease }) {
        return {
          researchBrief: {
            schemaVersion: '1.0.0',
            id: 'rbr.local.001',
            tenantId: workflowRun.tenantId,
            workflowRunId: workflowRun.id,
            rawDiseaseInput: workflowInput.diseaseName,
            normalizedDiseaseInput: 'langerhans cell histiocytosis',
            targetCanonicalDiseaseName: canonicalDisease.canonicalDiseaseName,
            audienceTier: workflowInput.audienceTier ?? 'provider-education',
            lengthProfile: 'standard',
            qualityProfile: 'commercial-grade',
            styleProfile: 'alien-detective-clinical-mystery',
            researchIntent: 'Compile a provisional pack.',
            allowedDomains: ['pubmed.ncbi.nlm.nih.gov'],
            createdAt: '2026-04-23T12:00:00Z',
          },
          sourceHarvest: {
            schemaVersion: '1.0.0',
            id: 'shr.local.001',
            tenantId: workflowRun.tenantId,
            workflowRunId: workflowRun.id,
            targetCanonicalDiseaseName: canonicalDisease.canonicalDiseaseName,
            sources: [
              {
                sourceId: 'src.local.001',
                sourceLabel: 'PubMed review',
                sourceType: 'review',
                origin: 'agent-web',
                sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/example',
                retrievedAt: '2026-04-23T12:00:00Z',
                captureMethod: 'responses-web-search',
                status: 'provisional',
              },
            ],
            droppedSources: [],
            generatedAt: '2026-04-23T12:00:00Z',
          },
          knowledgePack: {
            schemaVersion: '1.0.0',
            id: 'kp.local.001',
            canonicalDiseaseName: 'Langerhans Cell Histiocytosis',
            packStatus: 'provisional',
            packScope: 'run',
            generationMode: 'agent-generated',
            derivedFromRunId: workflowRun.id,
            sourceOrigins: {
              seeded: 0,
              'user-doc': 0,
              'agent-web': 1,
            },
            aliases: ['Langerhans cell histiocytosis'],
            ontologyId: 'prov:langerhans-cell-histiocytosis',
            diseaseCategory: 'provisional-research-needed',
            educationalFocus: ['immune dysregulation'],
            clinicalSummary: {
              oneSentence: 'A rare clonal immune-cell disorder should still compile into a traceable mystery.',
              patientExperienceSummary: 'Symptoms vary by organ involvement and require cautious review.',
              keyMechanism: 'Pathologic Langerhans-cell accumulation injures involved tissue.',
              timeScale: 'variable',
            },
            physiologyPrerequisites: [],
            pathophysiology: [],
            presentation: {
              hallmarkSymptoms: ['rash', 'bone pain'],
              riskFactors: [],
            },
            diagnostics: {
              firstLineTests: ['targeted imaging'],
              confirmatoryTests: ['biopsy'],
            },
            management: {
              stabilization: ['organ-specific support'],
              diseaseDirectedCare: ['specialty referral'],
            },
            evidence: [
              {
                claimId: 'clm.lch.001',
                claimText: 'Pathologic Langerhans-cell accumulation injures involved tissue.',
                sourceId: 'src.local.001',
                sourceLabel: 'PubMed review',
                sourceType: 'review',
                sourceLocator: 'discussion',
                confidence: 0.82,
                claimType: 'mechanism',
                certaintyLevel: 'moderate',
                diseaseStageApplicability: 'general',
                patientSubgroupApplicability: 'general',
                importanceRank: 1,
              },
            ],
            sourceCatalog: [
              {
                id: 'src.local.001',
                canonicalDiseaseName: 'Langerhans Cell Histiocytosis',
                sourceLabel: 'PubMed review',
                sourceType: 'review',
                sourceTier: 'tenant-pack',
                origin: 'agent-web',
                retrievedAt: '2026-04-23T12:00:00Z',
                captureMethod: 'responses-web-search',
                reviewState: 'provisional',
                defaultApprovalStatus: 'conditional',
                owner: 'clinical-governance',
                primaryOwnerRole: 'Clinical Reviewer',
                backupOwnerRole: 'Product Editor',
                refreshCadenceDays: 180,
                governanceNotes: [],
                topics: ['immune dysregulation'],
                sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/example',
                lastReviewedAt: '2026-04-23T12:00:00Z',
              },
            ],
            clinicalTeachingPoints: [
              {
                order: 1,
                title: 'Immune-cell accumulation',
                teachingPoint: 'Clonal Langerhans-cell accumulation can affect multiple organs and should stay evidence-bound.',
                linkedClaimIds: ['clm.lch.001'],
              },
            ],
            visualAnchors: [
              {
                anchorId: 'vanchor.lch.001',
                title: 'Abnormal immune-cell cluster',
                bodyScale: 'tissue',
                location: 'multiorgan tissue interface',
                description: 'Show a focal cluster of abnormal immune cells disrupting normal tissue geometry.',
                linkedClaimIds: ['clm.lch.001'],
              },
            ],
            evidenceRelationships: [],
            generatedAt: '2026-04-23T12:00:00Z',
            generatedBy: 'research-assembly-agent',
          },
          buildReport: {
            schemaVersion: '1.0.0',
            id: 'kbr.local.001',
            tenantId: workflowRun.tenantId,
            workflowRunId: workflowRun.id,
            targetCanonicalDiseaseName: 'Langerhans Cell Histiocytosis',
            status: 'ready',
            claimCount: 1,
            sourceCount: 1,
            blockingIssues: [],
            warnings: ['Rare disease review is still provisional.'],
            missingEvidenceAreas: [],
            fitForStoryContinuation: true,
            generatedAt: '2026-04-23T12:00:00Z',
          },
          responseSources: [],
        };
      },
    },
  });

  try {
    const project = await createProject(app.baseUrl, {
      diseaseName: 'Langerhans cell histiocytosis',
      audienceTier: 'provider-education',
    });
    const workflowRun = await startWorkflowRun(app.baseUrl, project.id);

    assert.equal(workflowRun.state, 'review');
    assert.equal(workflowRun.currentStage, 'render-prep');
    assert.equal(workflowRun.pauseReason, 'render-guide-review-required');
    assert.equal(workflowRun.artifacts.some((/** @type {{ artifactType: string }} */ artifact) => artifact.artifactType === 'research-brief'), true);
    assert.equal(workflowRun.artifacts.some((/** @type {{ artifactType: string }} */ artifact) => artifact.artifactType === 'disease-knowledge-pack'), true);
    assert.equal(workflowRun.artifacts.some((/** @type {{ artifactType: string }} */ artifact) => artifact.artifactType === 'visual-reference-pack'), true);
    assert.equal(workflowRun.artifacts.some((/** @type {{ artifactType: string }} */ artifact) => artifact.artifactType === 'rendered-asset-manifest'), false);

    const researchBriefResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs/${encodeURIComponent(workflowRun.id)}/research-brief`);
    assert.equal(researchBriefResponse.status, 200);
    const researchBrief = await researchBriefResponse.json();
    assert.equal(researchBrief.rawDiseaseInput, 'Langerhans cell histiocytosis');

    const buildReportResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs/${encodeURIComponent(workflowRun.id)}/knowledge-pack-build-report`);
    assert.equal(buildReportResponse.status, 200);
    const buildReport = await buildReportResponse.json();
    assert.equal(buildReport.fitForStoryContinuation, true);

    const blockedExportResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs/${encodeURIComponent(workflowRun.id)}/exports`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ version: 'lch-local-1' }),
    });
    assert.equal(blockedExportResponse.status, 409);

    const approvePackResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs/${encodeURIComponent(workflowRun.id)}/knowledge-pack/approve`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        decision: 'approved',
        reason: 'Local reviewer approved the provisional pack for this run.',
      }),
    });
    assert.equal(approvePackResponse.status, 200);
  } finally {
    await app.close();
    await sandbox.cleanup();
  }
});

test('free-text disease input falls back to local fixture research without an API key', async () => {
  const sandbox = await createSandbox();
  const app = await startServer({
    ...sandbox,
    openaiApiKey: '',
    renderProvider: 'stub-image',
    renderProviderApiKey: '',
  });

  try {
    const project = await createProject(app.baseUrl, {
      diseaseName: 'Unmapped local syndrome',
      audienceTier: 'provider-education',
    });
    const workflowRun = await startWorkflowRun(app.baseUrl, project.id);

    assert.equal(workflowRun.state, 'review');
    assert.equal(workflowRun.currentStage, 'render-prep');
    assert.equal(workflowRun.pauseReason, 'render-guide-review-required');

    const artifactListResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs/${encodeURIComponent(workflowRun.id)}/artifacts?artifactType=disease-knowledge-pack,source-harvest&expand=true`);
    assert.equal(artifactListResponse.status, 200);
    const artifactList = await artifactListResponse.json();
    const knowledgePack = artifactList.artifacts.find((/** @type {any} */ artifact) => artifact.artifactType === 'disease-knowledge-pack')?.payload;
    const sourceHarvest = artifactList.artifacts.find((/** @type {any} */ artifact) => artifact.artifactType === 'source-harvest')?.payload;

    assert.equal(knowledgePack.generationMode, 'local-fixture');
    assert.equal(knowledgePack.packStatus, 'provisional');
    assert.equal(knowledgePack.sourceOrigins['local-fixture'], 1);
    assert.equal(sourceHarvest.sources[0].origin, 'local-fixture');

    const buildReportResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs/${encodeURIComponent(workflowRun.id)}/knowledge-pack-build-report`);
    assert.equal(buildReportResponse.status, 200);
    const buildReport = await buildReportResponse.json();
    assert.equal(buildReport.status, 'review-required');
    assert.match(buildReport.warnings.join(' '), /No OpenAI API key/u);

    const blockedExportResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs/${encodeURIComponent(workflowRun.id)}/exports`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ version: 'unmapped-local-fixture-1' }),
    });
    assert.equal(blockedExportResponse.status, 409);
  } finally {
    await app.close();
    await sandbox.cleanup();
  }
});

test('mentions and assignments create notifications, and queue analytics summarize work', async () => {
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
        assigneeId: 'local-operator',
        status: 'queued',
        notes: 'Review provisional findings.',
      }),
    });
    assert.equal(assignmentResponse.status, 201);

    const threadResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs/${encodeURIComponent(workflowRun.id)}/threads`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Clinical follow-up',
        scopeType: 'run',
      }),
    });
    assert.equal(threadResponse.status, 201);
    const thread = await threadResponse.json();

    const messageResponse = await fetch(`${app.baseUrl}/api/v1/review-threads/${encodeURIComponent(thread.id)}/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        body: 'Please review this run next. @local-operator',
        mentions: ['local-operator'],
        resolutionNote: 'Thread resolved after local operator acknowledgement.',
      }),
    });
    assert.equal(messageResponse.status, 201);
    const message = await messageResponse.json();
    assert.equal(message.status, 'resolved');

    const notificationsResponse = await fetch(`${app.baseUrl}/api/v1/notifications`);
    assert.equal(notificationsResponse.status, 200);
    const notifications = await notificationsResponse.json();

    assert.equal(notifications.some((/** @type {{ notificationType: string }} */ notification) => notification.notificationType === 'assignment'), true);
    assert.equal(notifications.some((/** @type {{ notificationType: string }} */ notification) => notification.notificationType === 'mention'), true);

    const analyticsResponse = await fetch(`${app.baseUrl}/api/v1/review-queue/analytics`);
    assert.equal(analyticsResponse.status, 200);
    const analytics = await analyticsResponse.json();

    assert.equal(analytics.summary.totalItemCount >= 1, true);
    assert.equal(analytics.summary.unreadNotificationCount >= 2, true);
    assert.equal(analytics.countsByWorkType.some((/** @type {{ workType: string }} */ row) => row.workType === 'run-review'), true);

    const snapshotResponse = await fetch(`${app.baseUrl}/api/v1/review-queue/analytics/snapshots`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        snapshotLabel: 'threaded-review-test',
      }),
    });
    assert.equal(snapshotResponse.status, 201, await snapshotResponse.clone().text());
    const snapshot = await snapshotResponse.json();
    assert.equal(snapshot.snapshotLabel, 'threaded-review-test');
    assert.equal(snapshot.analytics.summary.totalItemCount >= 1, true);

    const snapshotHistoryResponse = await fetch(`${app.baseUrl}/api/v1/review-queue/analytics/history`);
    assert.equal(snapshotHistoryResponse.status, 200);
    const snapshotHistory = await snapshotHistoryResponse.json();
    assert.equal(snapshotHistory.some((/** @type {any} */ item) => item.id === snapshot.id), true);

    const proofScenarioResponse = await fetch(`${app.baseUrl}/api/v1/review-queue/proof-scenario`, {
      method: 'POST',
    });
    assert.equal(proofScenarioResponse.status, 201, await proofScenarioResponse.clone().text());
    const proofScenario = await proofScenarioResponse.json();
    assert.equal(proofScenario.scenarioCases.length, 5);
    assert.equal(proofScenario.workItems.length, 5);
    assert.equal(
      proofScenario.workItems.some((/** @type {any} */ item) => item.metadata?.proofScenarioId === 'pilot-proof.render-retry'),
      true,
    );

    const threadsResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs/${encodeURIComponent(workflowRun.id)}/threads`);
    assert.equal(threadsResponse.status, 200);
    const threads = await threadsResponse.json();
    assert.equal(threads.find((/** @type {any} */ item) => item.id === thread.id)?.status, 'resolved');
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
    await approveRenderingGuide(app.baseUrl, workflowRun.id);
    await queueRenderJob(app.baseUrl, workflowRun.id);
    const postRenderRunResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs/${encodeURIComponent(workflowRun.id)}`);
    workflowRun = await postRenderRunResponse.json();
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
    assert.equal(localRuntimeView.localStoragePolicy.filesStayLocal, true);
    assert.equal(localRuntimeView.localStoragePolicy.filesPersistedInPostgres, false);
    assert.equal(localRuntimeView.localStoragePolicy.objectStore, 'filesystem');
    assert.equal(localRuntimeView.availableCommands.includes('pnpm ops:restore-smoke'), true);
    assert.equal('managedRuntimeReadiness' in localRuntimeView, false);
    assert.equal(localRuntimeView.externalElements.clinicalEducationCompatibility.enabled, true);
    assert.equal(localRuntimeView.externalElements.openAi.renderModel, 'gpt-image-2');
    assert.equal(localRuntimeView.externalElements.pipeline.maxConcurrentRuns, 1);
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

    const sourceCalendarResponse = await fetch(`${app.baseUrl}/api/v1/source-ops/calendar`);
    assert.equal(sourceCalendarResponse.status, 200);
    const sourceCalendar = await sourceCalendarResponse.json();
    assert.equal(sourceCalendar.summary.totalSourceCount > 0, true);
    assert.equal(sourceCalendar.items.some((/** @type {any} */ item) => item.sourceId === sourceRecord.id), true);

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

    const blockedRenderJobResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs/${encodeURIComponent(workflowRun.id)}/render-jobs`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    assert.equal(blockedRenderJobResponse.status, 409);

    await approveRenderingGuide(app.baseUrl, workflowRun.id);
    const renderJobPayload = await queueRenderJob(app.baseUrl, workflowRun.id);
    assert.equal(renderJobPayload.renderJob.workflowRunId, workflowRun.id);
    assert.ok(renderJobPayload.renderJob.renderingGuideId);
    assert.ok(renderJobPayload.renderJob.visualReferencePackId);

    const renderJobDetailResponse = await fetch(`${app.baseUrl}/api/v1/render-jobs/${encodeURIComponent(renderJobPayload.renderJob.id)}`);
    assert.equal(renderJobDetailResponse.status, 200);
    const renderJobDetail = await renderJobDetailResponse.json();
    assert.equal(Array.isArray(renderJobDetail.attempts), true);
    assert.equal(Array.isArray(renderJobDetail.renderedAssets), true);
    assert.equal(renderJobDetail.completedRenderCount, renderJobDetail.totalRenderCount);
    assert.equal(renderJobDetail.completedRenderPromptIds.length, renderJobDetail.totalRenderCount);
    assert.equal(renderJobDetail.activeRenderPromptId, undefined);
    assert.equal(renderJobDetail.renderedAssetManifest.renderMode, 'stub-placeholder');
    assert.equal(renderJobDetail.renderedAssetManifest.localValidation.structuralOnly, true);
    assert.equal(renderJobDetail.renderedAssetManifest.renderedAssets.every((/** @type {any} */ asset) => asset.letteringSeparationStatus === 'passed'), true);

    const qaDecisionResponse = await fetch(`${app.baseUrl}/api/v1/rendered-asset-manifests/${encodeURIComponent(renderJobDetail.renderedAssetManifest.id)}/qa-decisions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        decision: 'structural-only',
        notes: 'Stub render QA recorded during local pilot proof.',
      }),
    });
    assert.equal(qaDecisionResponse.status, 201, await qaDecisionResponse.clone().text());
    const qaDecision = await qaDecisionResponse.json();
    assert.equal(qaDecision.decision, 'structural-only');
    assert.equal(qaDecision.checklist.letteringSeparation, true);

    const qaDecisionListResponse = await fetch(`${app.baseUrl}/api/v1/rendered-asset-manifests/${encodeURIComponent(renderJobDetail.renderedAssetManifest.id)}/qa-decisions`);
    assert.equal(qaDecisionListResponse.status, 200);
    const qaDecisionList = await qaDecisionListResponse.json();
    assert.equal(qaDecisionList.some((/** @type {any} */ item) => item.id === qaDecision.id), true);
  } finally {
    await app.close();
    await sandbox.cleanup();
  }
});
