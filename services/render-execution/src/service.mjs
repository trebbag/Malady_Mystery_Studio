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
  id: 'rtp.openai-image-default',
  provider: 'openai-image',
  model: 'gpt-image-2',
  supportedAspectRatios: ['4:3', '16:9', '1:1'],
  fallbackStrategies: ['baseline', 'simplified-composition', 'tight-anatomy'],
  textHandlingPolicy: 'Never request visible lettering in generated art; preserve lettering as a separate overlay.',
  watermarkPolicy: 'Provider output may include vendor safety metadata; do not rely on the generated image as the text layer.',
  notes: [
    'OpenAI image output must be continuity anchored and medically constrained.',
    'Fallback prompts should simplify composition before weakening anatomy locks.',
  ],
});

/**
 * @param {{ positivePrompt: string }} renderPrompt
 * @param {string} strategy
 * @returns {string}
 */
function strategyPrompt(renderPrompt, strategy) {
  const basePrompt = [
    renderPrompt.positivePrompt,
    renderPrompt.aspectRatio ? `Target aspect ratio: ${renderPrompt.aspectRatio}.` : '',
    renderPrompt.negativePrompt ? `Avoid the following problems: ${renderPrompt.negativePrompt}.` : '',
  ].filter(Boolean).join(' ');

  switch (strategy) {
    case 'simplified-composition':
      return `${basePrompt} Simplify the composition to a single clear focal action while preserving continuity anchors.`;
    case 'tight-anatomy':
      return `${basePrompt} Make anatomy and mechanism unusually explicit and avoid ornamental background clutter.`;
    default:
      return basePrompt;
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

function mapAspectRatioToSize(aspectRatio) {
  switch (aspectRatio) {
    case '16:9':
      return '1536x1024';
    case '4:3':
      return '1024x1024';
    default:
      return '1024x1024';
  }
}

class OpenAiImageProvider {
  /**
   * @param {string} apiKey
   * @param {string} [model]
   */
  constructor(apiKey, model = DEFAULT_RENDER_TARGET_PROFILE.model) {
    this.apiKey = apiKey;
    this.provider = 'openai-image';
    this.model = model;
  }

  /**
   * @param {{ id: string, positivePrompt: string }} renderPrompt
   * @param {string} strategy
   * @returns {Promise<any>}
   */
  async generate(renderPrompt, strategy) {
    if (!this.apiKey) {
      throw new Error('OpenAI image generation requires OPENAI_API_KEY or RENDER_PROVIDER_API_KEY.');
    }

    const response = await fetch(
      'https://api.openai.com/v1/images/generations',
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          prompt: strategyPrompt(renderPrompt, strategy),
          size: mapAspectRatioToSize(renderPrompt.aspectRatio),
          quality: 'high',
          background: 'opaque',
          output_format: 'png',
        }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAI image request failed: ${response.status} ${response.statusText}. ${text}`);
    }

    const payload = await response.json();
    const imagePart = payload?.data?.find((/** @type {any} */ item) => typeof item?.b64_json === 'string');

    if (!imagePart) {
      throw new Error('OpenAI image response did not include b64_json image data.');
    }

    return {
      provider: this.provider,
      model: this.model,
      strategy,
      mimeType: 'image/png',
      buffer: Buffer.from(imagePart.b64_json, 'base64'),
      providerRequestId: payload?.id ?? createId('greq'),
      width: Number.parseInt(String(mapAspectRatioToSize(renderPrompt.aspectRatio).split('x')[0] ?? ''), 10) || undefined,
      height: Number.parseInt(String(mapAspectRatioToSize(renderPrompt.aspectRatio).split('x')[1] ?? ''), 10) || undefined,
    };
  }
}

/**
 * @param {{ provider?: string, apiKey?: string }} [options]
 */
export function createRenderExecutionService(options = {}) {
  const providerName = options.provider
    ?? process.env.RENDER_PROVIDER
    ?? (process.env.OPENAI_API_KEY ? 'openai-image' : 'stub-image');
  const provider = providerName === 'openai-image'
    ? new OpenAiImageProvider(
      options.apiKey ?? process.env.RENDER_PROVIDER_API_KEY ?? process.env.OPENAI_API_KEY ?? '',
      process.env.OPENAI_RENDER_MODEL ?? DEFAULT_RENDER_TARGET_PROFILE.model,
    )
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
