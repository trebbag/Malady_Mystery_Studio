import { createId } from '../../../packages/shared-config/src/ids.mjs';

const SCHEMA_VERSION = '1.0.0';
const CYTO_ID = 'vref.character.cyto-kine';
const PIP_ID = 'vref.character.pip';
const STYLE_ID = 'vref.style.series-felt-cinematic';
const PROP_IDS = Object.freeze({
  hudVisor: 'vref.prop.hud-visor',
  evidenceVial: 'vref.prop.evidence-vial',
  microScanner: 'vref.prop.micro-scanner',
  agencyBadge: 'vref.prop.agency-badge',
});
const PREMIUM_FELT_STYLE_LOCKS = Object.freeze([
  'premium cinematic 3D animated felt-toy rendering',
  'warm feature-animation lighting with soft tactile fibers',
  'expressive eyes, rounded silhouettes, and subtle stitching',
  'accurate approachable 3D anatomy environments with no gore',
  'stable character proportions and reusable prop silhouettes across panels',
]);

/**
 * @param {unknown[]} values
 * @returns {string[]}
 */
function uniqueStrings(values) {
  return [...new Set(values
    .filter((value) => typeof value === 'string' && value.trim().length > 0)
    .map((value) => String(value).trim()))];
}

/**
 * @param {string} value
 * @returns {string}
 */
function slugify(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'reference';
}

/**
 * @param {any} panel
 * @returns {string}
 */
function panelText(panel) {
  return [
    panel.panelId,
    panel.location,
    panel.actionSummary,
    panel.storyFunction,
    panel.medicalObjective,
    ...(panel.continuityAnchors ?? []),
    ...(panel.openAiImagePrompt?.characterLocks ?? []),
    ...(panel.openAiImagePrompt?.styleLocks ?? []),
  ].join(' ').toLowerCase();
}

/**
 * @param {any} panel
 * @param {string} needle
 * @returns {boolean}
 */
function panelMentions(panel, needle) {
  return panelText(panel).includes(needle.toLowerCase());
}

/**
 * @param {any[]} panels
 * @param {(panel: any) => boolean} predicate
 * @returns {string[]}
 */
function panelIdsWhere(panels, predicate) {
  return panels.filter(predicate).map((panel) => panel.panelId);
}

/**
 * @param {any[]} panels
 * @returns {Map<string, string[]>}
 */
function mapPanelsBySetPiece(panels) {
  const bySetPiece = new Map();

  for (const panel of panels) {
    const key = `${panel.location ?? 'unknown setting'} at ${panel.bodyScale ?? 'unknown scale'}`;
    const panelIds = bySetPiece.get(key) ?? [];
    panelIds.push(panel.panelId);
    bySetPiece.set(key, panelIds);
  }

  return bySetPiece;
}

/**
 * @param {{ id: string, tenantId: string, workflowRunId: string, renderingGuideId: string, itemType: string, canonicalName: string, description?: string, source?: string, approvalStatus?: string, usagePanelIds: string[], textLocks: string[], personalityLocks?: string[], continuityLocks?: string[], styleLocks?: string[], negativeLocks?: string[], createdAt: string }} options
 * @returns {any}
 */
function buildItem(options) {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: options.id,
    tenantId: options.tenantId,
    workflowRunId: options.workflowRunId,
    renderingGuideId: options.renderingGuideId,
    itemType: options.itemType,
    canonicalName: options.canonicalName,
    ...(options.description ? { description: options.description } : {}),
    source: options.source ?? 'local-canon',
    approvalStatus: options.approvalStatus ?? 'pending',
    usagePanelIds: uniqueStrings(options.usagePanelIds),
    imageReferenceLocations: [],
    textLocks: uniqueStrings(options.textLocks),
    personalityLocks: uniqueStrings(options.personalityLocks ?? []),
    continuityLocks: uniqueStrings(options.continuityLocks ?? []),
    styleLocks: uniqueStrings(options.styleLocks ?? []),
    negativeLocks: uniqueStrings(options.negativeLocks ?? []),
    createdAt: options.createdAt,
  };
}

/**
 * @param {any} renderingGuide
 * @returns {Map<string, string[]>}
 */
function buildPanelReferenceMap(renderingGuide) {
  const panels = renderingGuide.panels ?? [];
  const setPieces = mapPanelsBySetPiece(panels);
  const map = new Map();

  for (const panel of panels) {
    /** @type {string[]} */
    const ids = [STYLE_ID];

    if (panelMentions(panel, 'cyto kine') || panelMentions(panel, 'lead investigator')) {
      ids.push(CYTO_ID, PROP_IDS.hudVisor, PROP_IDS.evidenceVial, PROP_IDS.agencyBadge);
    }

    if (panelMentions(panel, 'deputy pip') || panelMentions(panel, 'field deputy')) {
      ids.push(PIP_ID, PROP_IDS.microScanner, PROP_IDS.agencyBadge);
    }

    const setPieceKey = `${panel.location ?? 'unknown setting'} at ${panel.bodyScale ?? 'unknown scale'}`;
    const setPiecePanelIds = setPieces.get(setPieceKey) ?? [];

    if (setPiecePanelIds.length > 1) {
      ids.push(`vref.set-piece.${slugify(setPieceKey)}`);
    }

    map.set(panel.panelId, uniqueStrings(ids));
  }

  return map;
}

/**
 * @param {{ workflowRun: any, renderingGuide: any, generatedAt: string }} options
 * @returns {any}
 */
export function buildVisualReferencePack(options) {
  /** @type {any[]} */
  const panels = options.renderingGuide.panels ?? [];
  const panelReferenceMap = buildPanelReferenceMap(options.renderingGuide);
  const cytoPanelIds = panelIdsWhere(panels, (panel) => panelReferenceMap.get(panel.panelId)?.includes(CYTO_ID) ?? false);
  const pipPanelIds = panelIdsWhere(panels, (panel) => panelReferenceMap.get(panel.panelId)?.includes(PIP_ID) ?? false);
  const setPieces = [...mapPanelsBySetPiece(panels).entries()].filter(([, panelIds]) => panelIds.length > 1);
  /** @type {any[]} */
  const items = [
    buildItem({
      id: STYLE_ID,
      tenantId: options.workflowRun.tenantId,
      workflowRunId: options.workflowRun.id,
      renderingGuideId: options.renderingGuide.id,
      itemType: 'style-frame',
      canonicalName: 'Series felt-cinematic style frame',
      description: 'Global visual style lock for all panels before any character, prop, set-piece, or final panel rendering.',
      usagePanelIds: panels.map((/** @type {any} */ panel) => panel.panelId),
      textLocks: [
        'Detective Cyto Kine and Deputy Pip: Micro-Mysteries of the Human Body',
        'Felt detective figures inside accurate, cinematic 3D anatomy spaces.',
      ],
      styleLocks: [...PREMIUM_FELT_STYLE_LOCKS],
      negativeLocks: [
        'no visible generated text',
        'no generic sci-fi background replacing the governed body environment',
        'no inconsistent character silhouettes',
      ],
      createdAt: options.generatedAt,
    }),
    buildItem({
      id: CYTO_ID,
      tenantId: options.workflowRun.tenantId,
      workflowRunId: options.workflowRun.id,
      renderingGuideId: options.renderingGuide.id,
      itemType: 'character',
      canonicalName: 'Detective Cyto Kine',
      description: 'Lead felt detective whose silhouette, visor, badge, and evidence vial must stay stable across panels.',
      usagePanelIds: cytoPanelIds,
      textLocks: [
        'felt lead investigator',
        'HUD visor',
        'tiny agency badge',
        'evidence vial',
        'stable rounded detective silhouette',
      ],
      personalityLocks: [
        'calm',
        'precise',
        'dryly funny',
        'protective of Pip',
        'delighted by elegant physiology when a mechanism clicks',
      ],
      continuityLocks: [
        'same face, fiber texture, proportions, visor, badge, and evidence vial whenever present',
        'expressions can change, identity and silhouette cannot drift',
      ],
      styleLocks: [...PREMIUM_FELT_STYLE_LOCKS],
      negativeLocks: ['do not make Cyto cynical about illness', 'do not change Cyto into a human or robot'],
      createdAt: options.generatedAt,
    }),
    buildItem({
      id: PIP_ID,
      tenantId: options.workflowRun.tenantId,
      workflowRunId: options.workflowRun.id,
      renderingGuideId: options.renderingGuide.id,
      itemType: 'character',
      canonicalName: 'Deputy Pip',
      description: 'Assistant felt detective whose silhouette, badge, and micro-scanner must stay stable across panels.',
      usagePanelIds: pipPanelIds,
      textLocks: [
        'felt field deputy',
        'tiny agency badge',
        'handheld micro-scanner',
        'action-forward learner posture',
        'stable rounded assistant silhouette',
      ],
      personalityLocks: [
        'earnest',
        'loyal',
        'curious',
        'theatrical in a noir way',
        'competent and physically expressive',
      ],
      continuityLocks: [
        'same face, fiber texture, proportions, badge, and micro-scanner whenever present',
        'slapstick can reveal information but must not make Pip incompetent',
      ],
      styleLocks: [...PREMIUM_FELT_STYLE_LOCKS],
      negativeLocks: ['do not portray Pip as incompetent', 'do not change Pip into a human or robot'],
      createdAt: options.generatedAt,
    }),
  ];

  /** @type {Array<[string, string, string, string[]]>} */
  const propDefinitions = [
    [PROP_IDS.hudVisor, 'HUD visor', 'Mission-context visor attached to Cyto without generated medical text.', cytoPanelIds],
    [PROP_IDS.evidenceVial, 'Evidence vial', 'Source-backed clue vial held or carried by Cyto with a consistent silhouette.', cytoPanelIds],
    [PROP_IDS.microScanner, 'Micro-scanner', 'Pip handheld scanner with a simple glow but no readable generated text.', pipPanelIds],
    [PROP_IDS.agencyBadge, 'Agency badge', 'Tiny felt badge shared by both detectives, scaled consistently.', uniqueStrings([...cytoPanelIds, ...pipPanelIds])],
  ];

  for (const [id, name, description, usagePanelIds] of propDefinitions) {
    items.push(buildItem({
      id,
      tenantId: options.workflowRun.tenantId,
      workflowRunId: options.workflowRun.id,
      renderingGuideId: options.renderingGuide.id,
      itemType: 'prop',
      canonicalName: name,
      description,
      usagePanelIds,
      textLocks: [name, description],
      continuityLocks: ['render separately as a reusable reference before panel generation after guide approval'],
      styleLocks: [...PREMIUM_FELT_STYLE_LOCKS],
      negativeLocks: ['no readable text on prop faces or screens'],
      createdAt: options.generatedAt,
    }));
  }

  for (const [setPieceKey, usagePanelIds] of setPieces) {
    items.push(buildItem({
      id: `vref.set-piece.${slugify(setPieceKey)}`,
      tenantId: options.workflowRun.tenantId,
      workflowRunId: options.workflowRun.id,
      renderingGuideId: options.renderingGuide.id,
      itemType: 'set-piece',
      canonicalName: setPieceKey,
      description: `Recurring set piece used by ${usagePanelIds.length} panels. Render and approve this separately after guide approval before final panels depend on it.`,
      source: 'run-artifact',
      usagePanelIds,
      textLocks: [setPieceKey],
      continuityLocks: [
        'keep landmarks, scale cues, lighting family, and camera geography stable across every referenced panel',
      ],
      styleLocks: [...PREMIUM_FELT_STYLE_LOCKS],
      negativeLocks: ['do not replace medical anatomy with decorative sci-fi scenery'],
      createdAt: options.generatedAt,
    }));
  }

  const mappedRows = panels.map((/** @type {any} */ panel) => ({
    panelId: panel.panelId,
    visualReferenceItemIds: panelReferenceMap.get(panel.panelId) ?? [],
  }));
  const warnings = [];

  if (cytoPanelIds.length === 0) {
    warnings.push('Detective Cyto Kine was not detected in any panel prompt locks.');
  }

  if (pipPanelIds.length === 0) {
    warnings.push('Deputy Pip was not detected in any panel prompt locks.');
  }

  if (setPieces.length === 0) {
    warnings.push('No repeated set pieces were detected; verify whether the story needs reusable environment references.');
  }

  const panelsWithReferenceItems = mappedRows.filter((/** @type {{ visualReferenceItemIds: string[] }} */ row) => row.visualReferenceItemIds.length > 0).length;

  return {
    schemaVersion: SCHEMA_VERSION,
    id: createId('vrp'),
    tenantId: options.workflowRun.tenantId,
    workflowRunId: options.workflowRun.id,
    renderingGuideId: options.renderingGuide.id,
    generatedAt: options.generatedAt,
    approvalStatus: 'not-reviewed',
    requiredBeforeRender: true,
    items,
    panelReferenceMap: mappedRows,
    coverageSummary: {
      panelCount: panels.length,
      panelsWithReferenceItems,
      missingPanelReferenceCount: Math.max(0, panels.length - panelsWithReferenceItems),
      requiredCharacterItems: 2,
      presentCharacterItems: [cytoPanelIds.length > 0, pipPanelIds.length > 0].filter(Boolean).length,
      recurringItemCount: setPieces.length + propDefinitions.filter(([, , , usagePanelIds]) => usagePanelIds.length > 0).length + 1,
      warnings,
    },
  };
}

/**
 * @param {any} renderingGuide
 * @param {any} visualReferencePack
 * @param {string} reviewStatus
 * @returns {any}
 */
export function applyVisualReferencePackToRenderingGuide(renderingGuide, visualReferencePack, reviewStatus = 'not-reviewed') {
  const panelReferenceMap = new Map((visualReferencePack.panelReferenceMap ?? []).map((/** @type {any} */ row) => [row.panelId, row.visualReferenceItemIds ?? []]));

  return {
    ...renderingGuide,
    visualReferencePackId: visualReferencePack.id,
    reviewStatus,
    referenceCoverageSummary: visualReferencePack.coverageSummary,
    panels: (renderingGuide.panels ?? []).map((/** @type {any} */ panel) => {
      const visualReferenceItemIds = panelReferenceMap.get(panel.panelId) ?? [];
      const basePrompt = String(panel.openAiImagePrompt?.prompt ?? '')
        .replace(/\s*Use approved visual reference item ids: [^.]*\./gu, '')
        .trim();

      return {
        ...panel,
        visualReferenceItemIds,
        openAiImagePrompt: {
          ...panel.openAiImagePrompt,
          prompt: [
            basePrompt,
            `Use approved visual reference item ids: ${visualReferenceItemIds.join(', ')}.`,
          ].filter(Boolean).join(' '),
        },
      };
    }),
  };
}
