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
  id: 'rtp.openai-gpt-image-2-default',
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
 * @param {{ positivePrompt: string, aspectRatio?: string, negativePrompt?: string }} renderPrompt
 * @param {string} strategy
 * @returns {string}
 */
function strategyPrompt(renderPrompt, strategy) {
  const basePrompt = [
    'Create a medically accurate, high-fidelity finished comic panel illustration.',
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
   * @param {{ id: string, positivePrompt: string, aspectRatio?: string, negativePrompt?: string }} renderPrompt
   * @param {string} strategy
   * @returns {Promise<any>}
   */
  async generate(renderPrompt, strategy) {
    const prompt = strategyPrompt(renderPrompt, strategy);

    return {
      provider: this.provider,
      model: this.model,
      strategy,
      mimeType: 'image/png',
      buffer: ONE_PIXEL_PNG,
      providerRequestId: `${renderPrompt.id}.${strategy}`,
      isPlaceholder: true,
      nonFinalReason: 'Local stub render used because no OpenAI image API key is configured. This validates structure only, not final art quality.',
      promptHash: sha256(prompt),
      width: 1,
      height: 1,
    };
  }
}

/**
 * @param {string | undefined} aspectRatio
 * @returns {string}
 */
function mapAspectRatioToSize(aspectRatio) {
  switch (aspectRatio) {
    case '16:9':
      return '1536x1024';
    case '4:3':
      return '1536x1024';
    default:
      return '1024x1024';
  }
}

/**
 * @param {string | undefined} size
 * @returns {{ width: number, height: number }}
 */
function parseSize(size) {
  const [width, height] = String(size ?? '1024x1024')
    .split('x')
    .map((value) => Number.parseInt(value, 10));

  return {
    width: Number.isFinite(width) && width > 0 ? width : 1024,
    height: Number.isFinite(height) && height > 0 ? height : 1024,
  };
}

/**
 * @param {any} renderPrompt
 * @returns {{ letteringHandledSeparately: boolean, renderVisibleText: boolean, status: 'passed' | 'failed' }}
 */
function summarizeLetteringSeparation(renderPrompt) {
  const letteringHandledSeparately = Boolean(renderPrompt?.textLayerPolicy?.letteringHandledSeparately);
  const renderVisibleText = Boolean(renderPrompt?.textLayerPolicy?.renderVisibleText);

  return {
    letteringHandledSeparately,
    renderVisibleText,
    status: letteringHandledSeparately && !renderVisibleText ? 'passed' : 'failed',
  };
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
   * @param {{ id: string, positivePrompt: string, aspectRatio?: string, negativePrompt?: string }} renderPrompt
   * @param {string} strategy
   * @returns {Promise<any>}
   */
  async generate(renderPrompt, strategy) {
    if (!this.apiKey) {
      throw new Error('OpenAI image generation requires OPENAI_API_KEY or RENDER_PROVIDER_API_KEY.');
    }

    const prompt = strategyPrompt(renderPrompt, strategy);
    const size = mapAspectRatioToSize(renderPrompt.aspectRatio);
    const dimensions = parseSize(size);

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
          prompt,
          size,
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
      promptHash: sha256(prompt),
      width: dimensions.width,
      height: dimensions.height,
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
        isPlaceholder: Boolean(renderedImage.isPlaceholder),
        ...(renderedImage.nonFinalReason ? { nonFinalReason: renderedImage.nonFinalReason } : {}),
        promptHash: renderedImage.promptHash ?? sha256(renderPrompt.positivePrompt ?? ''),
        retryStrategy: renderedImage.strategy ?? 'baseline',
        continuityLocks: Array.isArray(renderPrompt.continuityAnchors) ? [...renderPrompt.continuityAnchors] : [],
        anatomyLocks: Array.isArray(renderPrompt.anatomyLocks) ? [...renderPrompt.anatomyLocks] : [],
        letteringSeparation: summarizeLetteringSeparation(renderPrompt),
        acceptanceChecks: [
          ...(Array.isArray(renderPrompt.acceptanceChecks) ? renderPrompt.acceptanceChecks : []),
          'Panel art must be reviewed against the separate lettering map before release.',
          ...(renderedImage.isPlaceholder ? ['Placeholder asset is not final artwork and must be replaced by live OpenAI output for visual quality certification.'] : []),
        ],
        createdAt: new Date().toISOString(),
      };
    },
    /**
     * @param {{ workflowRun: any, renderJob: any, renderedAssets: any[] }} options
     * @returns {any}
     */
    buildRenderedAssetManifest({ workflowRun, renderJob, renderedAssets }) {
      const renderMode = renderJob.provider === 'stub-image'
        ? 'stub-placeholder'
        : (renderJob.provider === 'external-manual' ? 'external-manual' : 'live-provider');
      const nonFinalPlaceholder = renderedAssets.some((asset) => asset.isPlaceholder);

      return {
        schemaVersion: '1.0.0',
        id: createId('rman'),
        tenantId: workflowRun.tenantId,
        workflowRunId: workflowRun.id,
        renderJobId: renderJob.id,
        renderTargetProfileId: DEFAULT_RENDER_TARGET_PROFILE.id,
        renderMode,
        nonFinalPlaceholder,
        providerNotice: nonFinalPlaceholder
          ? 'Local stub images validate panel coverage, prompt traceability, and release wiring only. They do not certify final image quality.'
          : 'Rendered asset manifest contains externally generated or live provider artwork.',
        allPanelsRendered: renderedAssets.length === renderJob.renderPromptIds.length,
        renderedAssets: renderedAssets.map((/** @type {any} */ asset) => ({
          renderedAssetId: asset.id,
          renderPromptId: asset.renderPromptId,
          panelId: asset.panelId,
          location: asset.location,
          checksum: asset.checksum,
          mimeType: asset.mimeType,
          isPlaceholder: Boolean(asset.isPlaceholder),
          promptHash: asset.promptHash,
          retryStrategy: asset.retryStrategy,
          letteringSeparationStatus: asset.letteringSeparation?.status ?? 'failed',
          continuityLockCount: asset.continuityLocks?.length ?? 0,
          anatomyLockCount: asset.anatomyLocks?.length ?? 0,
          acceptanceCheckCount: asset.acceptanceChecks?.length ?? 0,
        })),
        localValidation: {
          structuralOnly: renderMode === 'stub-placeholder',
          requiredPanelCount: renderJob.renderPromptIds.length,
          renderedPanelCount: renderedAssets.length,
          panelPromptHashes: Object.fromEntries(renderedAssets.map((asset) => [asset.renderPromptId, asset.promptHash])),
          letteringSeparationPassed: renderedAssets.every((asset) => asset.letteringSeparation?.status === 'passed'),
          continuityLocksPresent: renderedAssets.every((asset) => (asset.continuityLocks?.length ?? 0) >= 2),
          anatomyLocksPresent: renderedAssets.every((asset) => (asset.anatomyLocks?.length ?? 0) >= 2),
        },
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
