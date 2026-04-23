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
    continuityAnchors: ['detective silhouettes', 'alveolar sacs'],
    anatomyLocks: ['alveolar wall remains readable', 'inflammatory fluid stays localized'],
    acceptanceChecks: ['No visible lettering appears in the generated art.'],
    textLayerPolicy: {
      letteringHandledSeparately: true,
      renderVisibleText: false,
    },
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
      continuityAnchors: ['detective silhouettes', 'alveolar sacs'],
      anatomyLocks: ['alveolar wall remains readable', 'inflammatory fluid stays localized'],
      acceptanceChecks: ['No visible lettering appears in the generated art.'],
      textLayerPolicy: {
        letteringHandledSeparately: true,
        renderVisibleText: false,
      },
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
  assert.equal(renderedAsset.isPlaceholder, true);
  assert.equal(renderedAsset.letteringSeparation.status, 'passed');
  assert.match(renderedAsset.nonFinalReason, /Local stub render/u);
  assert.equal(typeof renderedAsset.promptHash, 'string');
  assert.equal(renderedAssetManifest.allPanelsRendered, true);
  assert.equal(renderedAssetManifest.renderMode, 'stub-placeholder');
  assert.equal(renderedAssetManifest.nonFinalPlaceholder, true);
  assert.equal(renderedAssetManifest.localValidation.structuralOnly, true);
  assert.equal(renderedAssetManifest.localValidation.letteringSeparationPassed, true);
  assert.equal(renderedAssetManifest.localValidation.continuityLocksPresent, true);
  assert.equal(renderedAssetManifest.localValidation.anatomyLocksPresent, true);
  assert.equal(renderedAssetManifest.renderTargetProfileId, DEFAULT_RENDER_TARGET_PROFILE.id);
});

test('openai image render service uses the image generations endpoint', async (t) => {
  const originalFetch = globalThis.fetch;
  /** @type {any[]} */
  const requests = [];
  globalThis.fetch = async (input, init) => {
    requests.push({
      url: String(input),
      init,
    });

    return new Response(JSON.stringify({
      id: 'imgreq.test.001',
      data: [{
        b64_json: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WwZ0iQAAAAASUVORK5CYII=',
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
    provider: 'openai-image',
    apiKey: 'test-api-key',
  });
  const renderedImage = await renderService.renderSinglePrompt({
    id: 'rnd.local.001',
    positivePrompt: 'Render a continuity-safe pancreatic islet scene with no visible text.',
    aspectRatio: '16:9',
    negativePrompt: 'no labels, no visible text',
  }, 'simplified-composition');

  assert.equal(renderedImage.provider, 'openai-image');
  assert.equal(requests.length, 1);
  assert.match(requests[0].url, /images\/generations/);
  const body = JSON.parse(String(requests[0].init?.body));
  assert.equal(body.model, 'gpt-image-2');
  assert.equal(body.size, '1536x1024');
  assert.match(body.prompt, /^Create a medically accurate, high-fidelity finished comic panel illustration\./);
  assert.match(body.prompt, /Simplify the composition/);
});
