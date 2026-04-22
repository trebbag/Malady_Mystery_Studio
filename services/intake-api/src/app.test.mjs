import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createApp } from './app.mjs';
import { createStarterOidcAssertion } from './auth.mjs';

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
 * @returns {Promise<{ baseUrl: string, close: () => Promise<void> }>}
 */
async function startServer(options) {
  const { server } = await createApp({
    dbFilePath: options.dbFilePath,
    objectStoreDir: options.objectStoreDir,
    allowHeaderAuthBypass: true,
  });

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(undefined));
  });

  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('Unable to determine starter API address.');
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(undefined);
        });
      });
    },
  };
}

/**
 * @param {string} userId
 * @param {Record<string, string>} [headers]
 * @returns {Record<string, string>}
 */
function authHeaders(userId, headers = {}) {
  /** @type {Record<string, string>} */
  const userIdMap = {
    'owner-01': 'usr.owner.001',
    'clinical-01': 'usr.clinical.001',
    'story-01': 'usr.story.001',
    'product-01': 'usr.product.001',
    'viewer-01': 'usr.viewer.001',
    'outsider-01': 'usr.outside.001',
  };

  return {
    'x-dcp-user-id': userIdMap[userId] ?? userId,
    ...headers,
  };
}

/**
 * @param {Response} response
 * @returns {string}
 */
function extractSessionCookie(response) {
  const cookieHeader = response.headers.get('set-cookie');

  if (!cookieHeader) {
    throw new Error('Expected a session cookie.');
  }

  return cookieHeader.split(';')[0];
}

test('real local password auth creates a persisted session cookie', async () => {
  const sandbox = await createSandbox();
  const app = await startServer(sandbox);

  try {
    const loginResponse = await fetch(`${app.baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        tenantSlug: 'studio-demo',
        email: 'owner@studio-demo.local',
        password: 'demo-password',
      }),
    });

    assert.equal(loginResponse.status, 200);
    const sessionCookie = extractSessionCookie(loginResponse);
    const authPayload = await loginResponse.json();

    assert.equal(authPayload.actor.email, 'owner@studio-demo.local');
    assert.equal(typeof authPayload.session.id, 'string');

    const meResponse = await fetch(`${app.baseUrl}/api/v1/auth/me`, {
      headers: {
        cookie: sessionCookie,
      },
    });
    assert.equal(meResponse.status, 200);
    const me = await meResponse.json();

    assert.equal(me.email, 'owner@studio-demo.local');
  } finally {
    await app.close();
    await sandbox.cleanup();
  }
});

test('starter OIDC assertion exchange creates a server-side session', async () => {
  const sandbox = await createSandbox();
  const app = await startServer(sandbox);

  try {
    const idToken = createStarterOidcAssertion({
      sub: 'oidc-user-001',
      email: 'sso-reviewer@studio-demo.local',
      name: 'SSO Reviewer',
      tenant_id: 'tenant.demo',
      roles: ['Viewer'],
    }, 'starter-oidc-shared-secret', {
      issuer: 'https://starter-idp.local',
      audience: 'malady-mystery-studio',
    });

    const exchangeResponse = await fetch(`${app.baseUrl}/api/v1/auth/sso/exchange`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        idToken,
      }),
    });

    assert.equal(exchangeResponse.status, 200);
    const sessionCookie = extractSessionCookie(exchangeResponse);
    const authPayload = await exchangeResponse.json();

    assert.equal(authPayload.actor.authProvider, 'oidc-hs256');
    assert.equal(authPayload.actor.email, 'sso-reviewer@studio-demo.local');

    const meResponse = await fetch(`${app.baseUrl}/api/v1/auth/me`, {
      headers: {
        cookie: sessionCookie,
      },
    });
    assert.equal(meResponse.status, 200);
    const me = await meResponse.json();
    assert.equal(me.email, 'sso-reviewer@studio-demo.local');
  } finally {
    await app.close();
    await sandbox.cleanup();
  }
});

test('create project stores intake preferences explicitly and tags tenant ownership', async () => {
  const sandbox = await createSandbox();
  const app = await startServer(sandbox);

  try {
    const projectResponse = await fetch(`${app.baseUrl}/api/v1/projects`, {
      method: 'POST',
      headers: authHeaders('owner-01', {
        'content-type': 'application/json',
      }),
      body: JSON.stringify({
        diseaseName: 'hepatocellular carcinoma',
        audienceTier: 'provider-education',
        lengthProfile: 'standard-issue',
        qualityProfile: 'pilot',
        styleProfile: 'whimsical-mystery',
      }),
    });

    assert.equal(projectResponse.status, 201);
    const project = await projectResponse.json();

    assert.equal(project.input.qualityProfile, 'pilot');
    assert.equal(project.input.styleProfile, 'whimsical-mystery');
    assert.equal(project.tenantId, 'tenant.demo');
  } finally {
    await app.close();
    await sandbox.cleanup();
  }
});

test('starting a workflow run generates scene, panel, render, lettering, and QA artifacts', async () => {
  const sandbox = await createSandbox();
  const app = await startServer(sandbox);

  try {
    const projectResponse = await fetch(`${app.baseUrl}/api/v1/projects`, {
      method: 'POST',
      headers: authHeaders('owner-01', {
        'content-type': 'application/json',
      }),
      body: JSON.stringify({
        diseaseName: 'community-acquired pneumonia',
        audienceTier: 'provider-education',
        qualityProfile: 'pilot',
      }),
    });
    const project = await projectResponse.json();

    const runResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs`, {
      method: 'POST',
      headers: authHeaders('owner-01', {
        'content-type': 'application/json',
      }),
      body: JSON.stringify({
        projectId: project.id,
      }),
    });

    assert.equal(runResponse.status, 202);
    const workflowRun = await runResponse.json();

    assert.equal(workflowRun.state, 'review');
    assert.equal(workflowRun.currentStage, 'review');
    assert.equal(workflowRun.tenantId, 'tenant.demo');

    const canonicalArtifact = workflowRun.artifacts.find(
      (/** @type {{ artifactType: string, artifactId: string }} */ artifact) => artifact.artifactType === 'canonical-disease',
    );
    const diseasePacketArtifact = workflowRun.artifacts.find(
      (/** @type {{ artifactType: string, artifactId: string }} */ artifact) => artifact.artifactType === 'disease-packet',
    );
    const storyWorkbookArtifact = workflowRun.artifacts.find(
      (/** @type {{ artifactType: string, artifactId: string }} */ artifact) => artifact.artifactType === 'story-workbook',
    );
    const storyMemoryArtifact = workflowRun.artifacts.find(
      (/** @type {{ artifactType: string, artifactId: string }} */ artifact) => artifact.artifactType === 'story-memory',
    );
    const reviewTraceArtifact = workflowRun.artifacts.find(
      (/** @type {{ artifactType: string, artifactId: string }} */ artifact) => artifact.artifactType === 'narrative-review-trace',
    );
    const qaReportArtifact = workflowRun.artifacts.find(
      (/** @type {{ artifactType: string, artifactId: string }} */ artifact) => artifact.artifactType === 'qa-report',
    );
    const sceneCardArtifact = workflowRun.artifacts.find(
      (/** @type {{ artifactType: string, artifactId: string }} */ artifact) => artifact.artifactType === 'scene-card',
    );
    const panelPlanArtifact = workflowRun.artifacts.find(
      (/** @type {{ artifactType: string, artifactId: string }} */ artifact) => artifact.artifactType === 'panel-plan',
    );
    const renderPromptArtifact = workflowRun.artifacts.find(
      (/** @type {{ artifactType: string, artifactId: string }} */ artifact) => artifact.artifactType === 'render-prompt',
    );
    const letteringMapArtifact = workflowRun.artifacts.find(
      (/** @type {{ artifactType: string, artifactId: string }} */ artifact) => artifact.artifactType === 'lettering-map',
    );

    assert.equal(typeof canonicalArtifact?.artifactId, 'string');
    assert.equal(typeof diseasePacketArtifact?.artifactId, 'string');
    assert.equal(typeof storyWorkbookArtifact?.artifactId, 'string');
    assert.equal(typeof storyMemoryArtifact?.artifactId, 'string');
    assert.equal(typeof reviewTraceArtifact?.artifactId, 'string');
    assert.equal(typeof qaReportArtifact?.artifactId, 'string');
    assert.equal(typeof sceneCardArtifact?.artifactId, 'string');
    assert.equal(typeof panelPlanArtifact?.artifactId, 'string');
    assert.equal(typeof renderPromptArtifact?.artifactId, 'string');
    assert.equal(typeof letteringMapArtifact?.artifactId, 'string');

    const canonicalResponse = await fetch(`${app.baseUrl}/api/v1/artifacts/canonical-disease/${canonicalArtifact.artifactId}`, {
      headers: authHeaders('viewer-01'),
    });
    assert.equal(canonicalResponse.status, 200);
    const canonicalDisease = await canonicalResponse.json();
    assert.equal(canonicalDisease.canonicalDiseaseName, 'Community-acquired pneumonia');

    const diseasePacketResponse = await fetch(`${app.baseUrl}/api/v1/artifacts/disease-packet/${diseasePacketArtifact.artifactId}`, {
      headers: authHeaders('viewer-01'),
    });
    assert.equal(diseasePacketResponse.status, 200);
    const diseasePacket = await diseasePacketResponse.json();

    assert.equal(diseasePacket.canonicalDiseaseName, 'Community-acquired pneumonia');
    assert.equal(diseasePacket.evidence.length > 0, true);

    const storyWorkbookResponse = await fetch(`${app.baseUrl}/api/v1/artifacts/story-workbook/${storyWorkbookArtifact.artifactId}`, {
      headers: authHeaders('viewer-01'),
    });
    assert.equal(storyWorkbookResponse.status, 200);
    const storyWorkbook = await storyWorkbookResponse.json();
    assert.equal(storyWorkbook.grandReveal.diagnosisName, 'Community-acquired pneumonia');

    const reviewTraceResponse = await fetch(
      `${app.baseUrl}/api/v1/artifacts/narrative-review-trace/${reviewTraceArtifact.artifactId}`,
      { headers: authHeaders('viewer-01') },
    );
    assert.equal(reviewTraceResponse.status, 200);
    const reviewTrace = await reviewTraceResponse.json();
    assert.equal(['pass', 'conditional-pass'].includes(reviewTrace.verdict), true);

    const qaReportResponse = await fetch(`${app.baseUrl}/api/v1/artifacts/qa-report/${qaReportArtifact.artifactId}`, {
      headers: authHeaders('viewer-01'),
    });
    assert.equal(qaReportResponse.status, 200);
    const qaReport = await qaReportResponse.json();
    assert.equal(['story-workbook', 'workflow-run'].includes(qaReport.subjectType), true);

    const sceneCardResponse = await fetch(`${app.baseUrl}/api/v1/artifacts/scene-card/${sceneCardArtifact.artifactId}`, {
      headers: authHeaders('viewer-01'),
    });
    assert.equal(sceneCardResponse.status, 200);
    const sceneCard = await sceneCardResponse.json();
    assert.equal(typeof sceneCard.goal, 'string');

    const panelPlanResponse = await fetch(`${app.baseUrl}/api/v1/artifacts/panel-plan/${panelPlanArtifact.artifactId}`, {
      headers: authHeaders('viewer-01'),
    });
    assert.equal(panelPlanResponse.status, 200);
    const panelPlan = await panelPlanResponse.json();
    assert.equal(panelPlan.panels.length > 0, true);

    const renderPromptResponse = await fetch(`${app.baseUrl}/api/v1/artifacts/render-prompt/${renderPromptArtifact.artifactId}`, {
      headers: authHeaders('viewer-01'),
    });
    assert.equal(renderPromptResponse.status, 200);
    const renderPrompt = await renderPromptResponse.json();
    assert.equal(renderPrompt.textLayerPolicy.letteringHandledSeparately, true);

    const letteringMapResponse = await fetch(`${app.baseUrl}/api/v1/artifacts/lettering-map/${letteringMapArtifact.artifactId}`, {
      headers: authHeaders('viewer-01'),
    });
    assert.equal(letteringMapResponse.status, 200);
    const letteringMap = await letteringMapResponse.json();
    assert.equal(letteringMap.entries.length > 0, true);
  } finally {
    await app.close();
    await sandbox.cleanup();
  }
});

test('ambiguous disease input can be reviewer-resolved and then continue to review', async () => {
  const sandbox = await createSandbox();
  const app = await startServer(sandbox);

  try {
    const projectResponse = await fetch(`${app.baseUrl}/api/v1/projects`, {
      method: 'POST',
      headers: authHeaders('owner-01', {
        'content-type': 'application/json',
      }),
      body: JSON.stringify({
        diseaseName: 'MG',
        audienceTier: 'provider-education',
        qualityProfile: 'pilot',
      }),
    });
    const project = await projectResponse.json();

    const runResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs`, {
      method: 'POST',
      headers: authHeaders('owner-01', {
        'content-type': 'application/json',
      }),
      body: JSON.stringify({
        projectId: project.id,
      }),
    });
    const failedRun = await runResponse.json();

    assert.equal(failedRun.state, 'failed');
    assert.equal(failedRun.currentStage, 'canonicalization');

    const resolutionResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs/${failedRun.id}/canonicalization-resolution`, {
      method: 'POST',
      headers: authHeaders('clinical-01', {
        'content-type': 'application/json',
      }),
      body: JSON.stringify({
        selectedCanonicalDiseaseName: 'Myasthenia gravis',
        reason: 'Clinician confirmed the intended disease after reviewing the ambiguous intake.',
      }),
    });

    assert.equal(resolutionResponse.status, 200);
    const resolvedRun = await resolutionResponse.json();

    assert.equal(resolvedRun.state, 'review');
    assert.equal(resolvedRun.currentStage, 'review');
    assert.equal(
      resolvedRun.artifacts.some(
        (/** @type {{ artifactType: string }} */ artifact) => artifact.artifactType === 'canonicalization-resolution',
      ),
      true,
    );

    const resolvedCanonicalArtifact = [...resolvedRun.artifacts]
      .reverse()
      .find((/** @type {{ artifactType: string, artifactId: string }} */ artifact) => artifact.artifactType === 'canonical-disease');
    const resolvedCanonicalResponse = await fetch(
      `${app.baseUrl}/api/v1/artifacts/canonical-disease/${resolvedCanonicalArtifact.artifactId}`,
      { headers: authHeaders('clinical-01') },
    );
    const resolvedCanonicalDisease = await resolvedCanonicalResponse.json();

    assert.equal(resolvedCanonicalDisease.canonicalDiseaseName, 'Myasthenia gravis');

    const auditResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs/${resolvedRun.id}/audit-log-entries`, {
      headers: authHeaders('clinical-01'),
    });
    assert.equal(auditResponse.status, 200);
    const auditLogs = await auditResponse.json();
    assert.equal(
      auditLogs.some((/** @type {{ action: string }} */ entry) => entry.action === 'canonicalization.resolve'),
      true,
    );
  } finally {
    await app.close();
    await sandbox.cleanup();
  }
});

test('role and tenant checks gate approvals', async () => {
  const sandbox = await createSandbox();
  const app = await startServer(sandbox);

  try {
    const projectResponse = await fetch(`${app.baseUrl}/api/v1/projects`, {
      method: 'POST',
      headers: authHeaders('owner-01', {
        'content-type': 'application/json',
      }),
      body: JSON.stringify({
        diseaseName: 'myasthenia gravis',
        audienceTier: 'provider-education',
        qualityProfile: 'pilot',
      }),
    });
    const project = await projectResponse.json();

    const runResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs`, {
      method: 'POST',
      headers: authHeaders('owner-01', {
        'content-type': 'application/json',
      }),
      body: JSON.stringify({
        projectId: project.id,
      }),
    });
    let workflowRun = await runResponse.json();

    assert.equal(workflowRun.state, 'review');

    const deniedRoleResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs/${workflowRun.id}/approvals`, {
      method: 'POST',
      headers: authHeaders('viewer-01', {
        'content-type': 'application/json',
      }),
      body: JSON.stringify({
        role: 'clinical',
        decision: 'approved',
      }),
    });
    assert.equal(deniedRoleResponse.status, 403);

    const deniedTenantResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs/${workflowRun.id}/approvals`, {
      method: 'POST',
      headers: authHeaders('outsider-01', {
        'content-type': 'application/json',
      }),
      body: JSON.stringify({
        role: 'clinical',
        decision: 'approved',
      }),
    });
    assert.equal(deniedTenantResponse.status, 403);

    for (const [userId, role] of [
      ['clinical-01', 'clinical'],
      ['story-01', 'editorial'],
      ['product-01', 'product'],
    ]) {
      const approvalResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs/${workflowRun.id}/approvals`, {
        method: 'POST',
        headers: authHeaders(userId, {
          'content-type': 'application/json',
        }),
        body: JSON.stringify({
          role,
          decision: 'approved',
          comment: `${role} review completed`,
        }),
      });

      assert.equal(approvalResponse.status, 200);
      workflowRun = await approvalResponse.json();
    }

    assert.equal(workflowRun.state, 'approved');
    assert.equal(workflowRun.currentStage, 'export');
  } finally {
    await app.close();
    await sandbox.cleanup();
  }
});

test('approved runs can be exported into release bundles with retrieval endpoints', async () => {
  const sandbox = await createSandbox();
  const app = await startServer(sandbox);

  try {
    const projectResponse = await fetch(`${app.baseUrl}/api/v1/projects`, {
      method: 'POST',
      headers: authHeaders('owner-01', {
        'content-type': 'application/json',
      }),
      body: JSON.stringify({
        diseaseName: 'community-acquired pneumonia',
        audienceTier: 'provider-education',
        qualityProfile: 'pilot',
      }),
    });
    const project = await projectResponse.json();

    const runResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs`, {
      method: 'POST',
      headers: authHeaders('owner-01', {
        'content-type': 'application/json',
      }),
      body: JSON.stringify({
        projectId: project.id,
      }),
    });
    let workflowRun = await runResponse.json();

    for (const [userId, role] of [
      ['clinical-01', 'clinical'],
      ['story-01', 'editorial'],
      ['product-01', 'product'],
    ]) {
      const approvalResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs/${workflowRun.id}/approvals`, {
        method: 'POST',
        headers: authHeaders(userId, {
          'content-type': 'application/json',
        }),
        body: JSON.stringify({
          role,
          decision: 'approved',
        }),
      });

      assert.equal(approvalResponse.status, 200);
      workflowRun = await approvalResponse.json();
    }

    assert.equal(workflowRun.state, 'approved');

    const exportResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs/${workflowRun.id}/exports`, {
      method: 'POST',
      headers: authHeaders('product-01', {
        'content-type': 'application/json',
      }),
      body: JSON.stringify({
        version: 'pilot-export-001',
      }),
    });

    assert.equal(exportResponse.status, 201);
    const exportPayload = await exportResponse.json();
    assert.equal(exportPayload.workflowRun.state, 'exported');
    assert.equal(exportPayload.releaseBundle.version, 'pilot-export-001');

    const releaseBundleResponse = await fetch(
      `${app.baseUrl}/api/v1/release-bundles/${exportPayload.releaseBundle.releaseId}`,
      { headers: authHeaders('viewer-01') },
    );
    assert.equal(releaseBundleResponse.status, 200);
    const releaseBundle = await releaseBundleResponse.json();
    assert.equal(
      releaseBundle.releaseGateChecks.every((/** @type {{ status: string }} */ gateCheck) => gateCheck.status === 'passed'),
      true,
    );

    const bundleIndexResponse = await fetch(
      `${app.baseUrl}/api/v1/release-bundles/${exportPayload.releaseBundle.releaseId}/index`,
      { headers: authHeaders('viewer-01') },
    );
    assert.equal(bundleIndexResponse.status, 200);
    const bundleIndex = await bundleIndexResponse.text();
    assert.match(bundleIndex, /Release Bundle/);

    const evidencePackResponse = await fetch(
      `${app.baseUrl}/api/v1/release-bundles/${exportPayload.releaseBundle.releaseId}/evidence-pack`,
      { headers: authHeaders('viewer-01') },
    );
    assert.equal(evidencePackResponse.status, 200);
    const evidencePack = await evidencePackResponse.json();
    assert.equal(Array.isArray(evidencePack.evidence), true);

    const exportHistoryResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs/${workflowRun.id}/exports`, {
      headers: authHeaders('viewer-01'),
    });
    assert.equal(exportHistoryResponse.status, 200);
    const exportHistory = await exportHistoryResponse.json();
    assert.equal(exportHistory.length, 1);
    assert.equal(exportHistory[0].releaseId, exportPayload.releaseBundle.releaseId);
  } finally {
    await app.close();
    await sandbox.cleanup();
  }
});

test('tenant admins can list and update server-side tenant role memberships', async () => {
  const sandbox = await createSandbox();
  const app = await startServer(sandbox);

  try {
    const listUsersResponse = await fetch(`${app.baseUrl}/api/v1/tenants/tenant.demo/users`, {
      headers: authHeaders('owner-01'),
    });
    assert.equal(listUsersResponse.status, 200);
    const users = await listUsersResponse.json();
    const viewerUser = users.find((/** @type {{ email: string }} */ user) => user.email === 'viewer@studio-demo.local');
    assert.equal(Boolean(viewerUser), true);

    const updateRolesResponse = await fetch(`${app.baseUrl}/api/v1/tenants/tenant.demo/users/${viewerUser.id}/roles`, {
      method: 'POST',
      headers: authHeaders('owner-01', {
        'content-type': 'application/json',
      }),
      body: JSON.stringify({
        roles: ['Viewer', 'Product Editor'],
      }),
    });
    assert.equal(updateRolesResponse.status, 200);
    const updatedUser = await updateRolesResponse.json();
    assert.equal(updatedUser.roles.includes('Product Editor'), true);
  } finally {
    await app.close();
    await sandbox.cleanup();
  }
});

test('repeated runs surface novelty warnings in the workbook QA artifacts', async () => {
  const sandbox = await createSandbox();
  const app = await startServer(sandbox);

  try {
    const projectResponse = await fetch(`${app.baseUrl}/api/v1/projects`, {
      method: 'POST',
      headers: authHeaders('owner-01', {
        'content-type': 'application/json',
      }),
      body: JSON.stringify({
        diseaseName: 'hepatocellular carcinoma',
        audienceTier: 'provider-education',
        qualityProfile: 'pilot',
        styleProfile: 'whimsical-mystery',
      }),
    });
    const project = await projectResponse.json();

    const firstRunResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs`, {
      method: 'POST',
      headers: authHeaders('owner-01', {
        'content-type': 'application/json',
      }),
      body: JSON.stringify({
        projectId: project.id,
      }),
    });
    assert.equal(firstRunResponse.status, 202);
    await firstRunResponse.json();

    const secondRunResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs`, {
      method: 'POST',
      headers: authHeaders('owner-01', {
        'content-type': 'application/json',
      }),
      body: JSON.stringify({
        projectId: project.id,
      }),
    });
    assert.equal(secondRunResponse.status, 202);
    const secondRun = await secondRunResponse.json();

    const reviewTraceArtifact = secondRun.artifacts.find(
      (/** @type {{ artifactType: string, artifactId: string }} */ artifact) => artifact.artifactType === 'narrative-review-trace',
    );
    assert.equal(typeof reviewTraceArtifact?.artifactId, 'string');

    const reviewTraceResponse = await fetch(
      `${app.baseUrl}/api/v1/artifacts/narrative-review-trace/${reviewTraceArtifact.artifactId}`,
      { headers: authHeaders('viewer-01') },
    );
    assert.equal(reviewTraceResponse.status, 200);
    const reviewTrace = await reviewTraceResponse.json();

    assert.equal(
      reviewTrace.findings.some((/** @type {{ category: string }} */ finding) => finding.category === 'novelty'),
      true,
    );
  } finally {
    await app.close();
    await sandbox.cleanup();
  }
});

test('durable store preserves projects and runs across app restarts', async () => {
  const sandbox = await createSandbox();
  const firstApp = await startServer(sandbox);

  try {
    const projectResponse = await fetch(`${firstApp.baseUrl}/api/v1/projects`, {
      method: 'POST',
      headers: authHeaders('owner-01', {
        'content-type': 'application/json',
      }),
      body: JSON.stringify({
        diseaseName: 'diabetic ketoacidosis',
        audienceTier: 'provider-education',
        qualityProfile: 'pilot',
      }),
    });
    const project = await projectResponse.json();

    const runResponse = await fetch(`${firstApp.baseUrl}/api/v1/workflow-runs`, {
      method: 'POST',
      headers: authHeaders('owner-01', {
        'content-type': 'application/json',
      }),
      body: JSON.stringify({
        projectId: project.id,
      }),
    });
    const workflowRun = await runResponse.json();

    await firstApp.close();

    const secondApp = await startServer(sandbox);

    try {
      const restoredProjectResponse = await fetch(`${secondApp.baseUrl}/api/v1/projects/${project.id}`, {
        headers: authHeaders('owner-01'),
      });
      assert.equal(restoredProjectResponse.status, 200);
      const restoredProject = await restoredProjectResponse.json();
      assert.equal(restoredProject.activeWorkflowRunId, workflowRun.id);

      const restoredRunResponse = await fetch(`${secondApp.baseUrl}/api/v1/workflow-runs/${workflowRun.id}`, {
        headers: authHeaders('owner-01'),
      });
      assert.equal(restoredRunResponse.status, 200);
      const restoredRun = await restoredRunResponse.json();
      assert.equal(restoredRun.id, workflowRun.id);
      assert.equal(restoredRun.currentStage, workflowRun.currentStage);
    } finally {
      await secondApp.close();
    }
  } finally {
    await sandbox.cleanup();
  }
});

test('review UI renders a full run and redirects unauthenticated viewers to sign-in', async () => {
  const sandbox = await createSandbox();
  const app = await startServer(sandbox);

  try {
    const projectResponse = await fetch(`${app.baseUrl}/api/v1/projects`, {
      method: 'POST',
      headers: authHeaders('owner-01', {
        'content-type': 'application/json',
      }),
      body: JSON.stringify({
        diseaseName: 'hepatocellular carcinoma',
        audienceTier: 'provider-education',
        qualityProfile: 'pilot',
      }),
    });
    const project = await projectResponse.json();

    const runResponse = await fetch(`${app.baseUrl}/api/v1/workflow-runs`, {
      method: 'POST',
      headers: authHeaders('owner-01', {
        'content-type': 'application/json',
      }),
      body: JSON.stringify({
        projectId: project.id,
      }),
    });
    const workflowRun = await runResponse.json();

    const unauthenticatedReviewResponse = await fetch(`${app.baseUrl}/review`, {
      redirect: 'manual',
    });
    assert.equal(unauthenticatedReviewResponse.status, 303);

    const loginResponse = await fetch(`${app.baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        tenantSlug: 'studio-demo',
        email: 'owner@studio-demo.local',
        password: 'demo-password',
      }),
    });
    const sessionCookie = extractSessionCookie(loginResponse);

    const reviewPageResponse = await fetch(`${app.baseUrl}/review/runs/${workflowRun.id}`, {
      headers: {
        cookie: sessionCookie,
      },
    });
    assert.equal(reviewPageResponse.status, 200);
    const reviewPageHtml = await reviewPageResponse.text();

    assert.match(reviewPageHtml, /Review Dashboard|Run summary/);
    assert.match(reviewPageHtml, new RegExp(workflowRun.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(reviewPageHtml, /Approvals/);
    assert.match(reviewPageHtml, /Artifacts/);

    const signInPageResponse = await fetch(`${app.baseUrl}/signin?redirectTo=/review`);
    assert.equal(signInPageResponse.status, 200);
    const signInPageHtml = await signInPageResponse.text();
    assert.match(signInPageHtml, /Developer Sign-in/);
    assert.match(signInPageHtml, /owner@studio-demo\.local/);
  } finally {
    await app.close();
    await sandbox.cleanup();
  }
});

test('evidence records are retrievable for reviewer views', async () => {
  const sandbox = await createSandbox();
  const app = await startServer(sandbox);

  try {
    const evidenceResponse = await fetch(`${app.baseUrl}/api/v1/evidence-records/clm.dka.005`, {
      headers: authHeaders('viewer-01'),
    });
    assert.equal(evidenceResponse.status, 200);
    const evidenceRecord = await evidenceResponse.json();

    assert.equal(evidenceRecord.claimId, 'clm.dka.005');
    assert.equal(typeof evidenceRecord.sourceLabel, 'string');
  } finally {
    await app.close();
    await sandbox.cleanup();
  }
});

test('source governance records are retrievable for reviewer views', async () => {
  const sandbox = await createSandbox();
  const app = await startServer(sandbox);

  try {
    const sourceListResponse = await fetch(
      `${app.baseUrl}/api/v1/source-records?canonicalDiseaseName=${encodeURIComponent('Hepatocellular carcinoma')}`,
      { headers: authHeaders('viewer-01') },
    );
    assert.equal(sourceListResponse.status, 200);
    const sourceRecords = await sourceListResponse.json();
    assert.equal(sourceRecords.length > 0, true);

    const sourceRecordResponse = await fetch(
      `${app.baseUrl}/api/v1/source-records/${sourceRecords[0].id}`,
      { headers: authHeaders('viewer-01') },
    );
    assert.equal(sourceRecordResponse.status, 200);
    const sourceRecord = await sourceRecordResponse.json();

    assert.equal(typeof sourceRecord.sourceTier, 'string');
    assert.equal(typeof sourceRecord.freshnessScore, 'number');
  } finally {
    await app.close();
    await sandbox.cleanup();
  }
});
