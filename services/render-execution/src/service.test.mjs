import assert from 'node:assert/strict';
import test from 'node:test';

import { createRenderExecutionService, DEFAULT_RENDER_TARGET_PROFILE } from './service.mjs';

test('stub render service creates queueable jobs and rendered asset manifests', async () => {
  const renderService = createRenderExecutionService({
    provider: 'stub-image',
  });
  const workflowRun = {
    id: 'run.local.001',
    tenantId: 'tenant.local',
  };
  const actor = {
    id: 'local-operator',
  };
  const renderJob = renderService.createRenderJob({
    workflowRun,
    actor,
    renderPromptIds: ['rnd.local.001'],
  });
  const renderedImage = await renderService.renderSinglePrompt({
    id: 'rnd.local.001',
    panelId: 'panel.local.001',
    positivePrompt: 'Render a medically grounded alveolar scene with no visible text.',
  }, 'baseline');
  const renderAttempt = renderService.buildRenderAttempt({
    workflowRun,
    renderJobId: renderJob.id,
    attemptNumber: 1,
    strategy: 'baseline',
    status: 'succeeded',
    providerRequestId: renderedImage.providerRequestId,
    renderedAssetIds: ['ras.local.001'],
  });
  const renderedAsset = renderService.buildRenderedAsset({
    workflowRun,
    renderJob,
    renderPrompt: {
      id: 'rnd.local.001',
      panelId: 'panel.local.001',
    },
    renderedImage,
    location: 'tenant.local/rendered-assets/ras.local.001.png',
    thumbnailLocation: 'tenant.local/rendered-assets/ras.local.001-thumb.png',
  });
  const renderedAssetManifest = renderService.buildRenderedAssetManifest({
    workflowRun,
    renderJob,
    renderedAssets: [renderedAsset],
  });

  assert.equal(renderService.providerName, 'stub-image');
  assert.equal(renderJob.queueName, 'render-execution');
  assert.equal(renderAttempt.status, 'succeeded');
  assert.equal(renderedAssetManifest.allPanelsRendered, true);
  assert.equal(renderedAssetManifest.renderTargetProfileId, DEFAULT_RENDER_TARGET_PROFILE.id);
});

test('gemini render service uses generateContent with text and image modalities', async (t) => {
  const originalFetch = globalThis.fetch;
  /** @type {any[]} */
  const requests = [];
  globalThis.fetch = async (input, init) => {
    requests.push({
      url: String(input),
      init,
    });

    return new Response(JSON.stringify({
      responseId: 'greq.test.001',
      candidates: [{
        content: {
          parts: [{
            inlineData: {
              mimeType: 'image/png',
              data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WwZ0iQAAAAASUVORK5CYII=',
            },
          }],
        },
      }],
    }), {
      status: 200,
      headers: {
        'content-type': 'application/json',
      },
    });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const renderService = createRenderExecutionService({
    provider: 'gemini-image',
    apiKey: 'test-api-key',
  });
  const renderedImage = await renderService.renderSinglePrompt({
    id: 'rnd.local.001',
    positivePrompt: 'Render a continuity-safe pancreatic islet scene with no visible text.',
  }, 'simplified-composition');

  assert.equal(renderedImage.provider, 'gemini-image');
  assert.equal(requests.length, 1);
  assert.match(requests[0].url, /generateContent/);
  const body = JSON.parse(String(requests[0].init?.body));
  assert.deepEqual(body.generationConfig.responseModalities, ['TEXT', 'IMAGE']);
  assert.match(body.contents[0].parts[0].text, /Simplify the composition/);
});
