import { createHash } from 'node:crypto';

import { createId } from '../../../packages/shared-config/src/ids.mjs';

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WwZ0iQAAAAASUVORK5CYII=',
  'base64',
);

/**
 * @param {Buffer | string} value
 * @returns {string}
 */
function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export const DEFAULT_RENDER_TARGET_PROFILE = Object.freeze({
  schemaVersion: '1.0.0',
  id: 'rtp.gemini-image-default',
  provider: 'gemini-image',
  model: 'gemini-3.1-flash-image-preview',
  supportedAspectRatios: ['4:3', '16:9', '1:1'],
  fallbackStrategies: ['baseline', 'simplified-composition', 'tight-anatomy'],
  textHandlingPolicy: 'Never request visible lettering in generated art; preserve lettering as a separate overlay.',
  watermarkPolicy: 'Provider output includes SynthID watermarking metadata at generation time.',
  notes: [
    'Gemini image output must be continuity anchored and medically constrained.',
    'Fallback prompts should simplify composition before weakening anatomy locks.',
  ],
});

/**
 * @param {{ positivePrompt: string }} renderPrompt
 * @param {string} strategy
 * @returns {string}
 */
function strategyPrompt(renderPrompt, strategy) {
  switch (strategy) {
    case 'simplified-composition':
      return `${renderPrompt.positivePrompt} Simplify the composition to a single clear focal action while preserving continuity anchors.`;
    case 'tight-anatomy':
      return `${renderPrompt.positivePrompt} Make anatomy and mechanism unusually explicit and avoid ornamental background clutter.`;
    default:
      return renderPrompt.positivePrompt;
  }
}

class StubRenderProvider {
  constructor() {
    this.provider = 'stub-image';
    this.model = 'stub-image-v1';
  }

  /**
   * @param {{ id: string, positivePrompt: string }} renderPrompt
   * @param {string} strategy
   * @returns {Promise<any>}
   */
  async generate(renderPrompt, strategy) {
    return {
      provider: this.provider,
      model: this.model,
      strategy,
      mimeType: 'image/png',
      buffer: ONE_PIXEL_PNG,
      providerRequestId: `${renderPrompt.id}.${strategy}`,
      width: 1,
      height: 1,
    };
  }
}

class GeminiImageProvider {
  /**
   * @param {string} apiKey
   * @param {string} [model]
   */
  constructor(apiKey, model = DEFAULT_RENDER_TARGET_PROFILE.model) {
    this.apiKey = apiKey;
    this.provider = 'gemini-image';
    this.model = model;
  }

  /**
   * @param {{ id: string, positivePrompt: string }} renderPrompt
   * @param {string} strategy
   * @returns {Promise<any>}
   */
  async generate(renderPrompt, strategy) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: strategyPrompt(renderPrompt, strategy),
              },
            ],
          }],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
          },
        }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Gemini image request failed: ${response.status} ${response.statusText}. ${text}`);
    }

    const payload = await response.json();
    const parts = payload?.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((/** @type {any} */ part) => part.inlineData?.data);

    if (!imagePart) {
      throw new Error('Gemini image response did not include inline image data.');
    }

    return {
      provider: this.provider,
      model: this.model,
      strategy,
      mimeType: imagePart.inlineData.mimeType ?? 'image/png',
      buffer: Buffer.from(imagePart.inlineData.data, 'base64'),
      providerRequestId: payload?.responseId ?? payload?.candidates?.[0]?.id ?? createId('greq'),
      width: undefined,
      height: undefined,
    };
  }
}

/**
 * @param {{ provider?: string, apiKey?: string }} [options]
 */
export function createRenderExecutionService(options = {}) {
  const providerName = options.provider ?? process.env.RENDER_PROVIDER ?? (process.env.GEMINI_API_KEY ? 'gemini-image' : 'stub-image');
  const provider = providerName === 'gemini-image'
    ? new GeminiImageProvider(options.apiKey ?? process.env.GEMINI_API_KEY ?? '')
    : new StubRenderProvider();

  return {
    providerName,
    provider,
    renderTargetProfile: {
      ...DEFAULT_RENDER_TARGET_PROFILE,
      provider: provider.provider,
      model: provider.model,
    },
    /**
     * @param {{ workflowRun: any, actor: any, renderPromptIds: string[] }} options
     * @returns {any}
     */
    createRenderJob({ workflowRun, actor, renderPromptIds }) {
      const timestamp = new Date().toISOString();

      return {
        schemaVersion: '1.0.0',
        id: createId('rjob'),
        tenantId: workflowRun.tenantId,
        workflowRunId: workflowRun.id,
        status: 'queued',
        approvalStatus: 'pending',
        queueName: 'render-execution',
        provider: provider.provider,
        model: provider.model,
        renderTargetProfileId: DEFAULT_RENDER_TARGET_PROFILE.id,
        renderPromptIds,
        attemptIds: [],
        createdBy: actor.id,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
    },
    /**
     * @param {{
     *   workflowRun: any,
     *   renderJobId: string,
     *   attemptNumber: number,
     *   strategy: string,
     *   status: string,
     *   providerRequestId?: string,
     *   renderedAssetIds?: string[],
     *   error?: Error | null,
     * }} options
     * @returns {any}
     */
    buildRenderAttempt({ workflowRun, renderJobId, attemptNumber, strategy, status, providerRequestId, renderedAssetIds = [], error }) {
      const timestamp = new Date().toISOString();

      return {
        schemaVersion: '1.0.0',
        id: createId('ratm'),
        renderJobId,
        workflowRunId: workflowRun.id,
        tenantId: workflowRun.tenantId,
        attemptNumber,
        strategy,
        status,
        providerRequestId,
        renderedAssetIds,
        errorCode: error ? 'provider-error' : undefined,
        errorMessage: error?.message,
        startedAt: timestamp,
        completedAt: timestamp,
      };
    },
    /**
     * @param {{ workflowRun: any, renderJob: any, renderPrompt: any, renderedImage: any, location: string, thumbnailLocation: string }} options
     * @returns {any}
     */
    buildRenderedAsset({ workflowRun, renderJob, renderPrompt, renderedImage, location, thumbnailLocation }) {
      return {
        schemaVersion: '1.0.0',
        id: createId('ras'),
        tenantId: workflowRun.tenantId,
        workflowRunId: workflowRun.id,
        renderJobId: renderJob.id,
        renderPromptId: renderPrompt.id,
        panelId: renderPrompt.panelId,
        provider: renderedImage.provider,
        model: renderedImage.model,
        mimeType: renderedImage.mimeType,
        checksum: sha256(renderedImage.buffer),
        location,
        thumbnailLocation,
        width: renderedImage.width,
        height: renderedImage.height,
        createdAt: new Date().toISOString(),
      };
    },
    /**
     * @param {{ workflowRun: any, renderJob: any, renderedAssets: any[] }} options
     * @returns {any}
     */
    buildRenderedAssetManifest({ workflowRun, renderJob, renderedAssets }) {
      return {
        schemaVersion: '1.0.0',
        id: createId('rman'),
        tenantId: workflowRun.tenantId,
        workflowRunId: workflowRun.id,
        renderJobId: renderJob.id,
        renderTargetProfileId: DEFAULT_RENDER_TARGET_PROFILE.id,
        allPanelsRendered: renderedAssets.length === renderJob.renderPromptIds.length,
        renderedAssets: renderedAssets.map((/** @type {any} */ asset) => ({
          renderedAssetId: asset.id,
          renderPromptId: asset.renderPromptId,
          panelId: asset.panelId,
          location: asset.location,
          checksum: asset.checksum,
          mimeType: asset.mimeType,
        })),
        generatedAt: new Date().toISOString(),
      };
    },
    /**
     * @param {any} renderPrompt
     * @param {string} strategy
     * @returns {Promise<any>}
     */
    async renderSinglePrompt(renderPrompt, strategy) {
      return provider.generate(renderPrompt, strategy);
    },
  };
}
