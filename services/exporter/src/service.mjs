import { createId } from '../../../packages/shared-config/src/ids.mjs';

const REQUIRED_RELEASE_ARTIFACT_TYPES = [
  'disease-packet',
  'story-workbook',
  'scene-card',
  'panel-plan',
  'render-prompt',
  'rendering-guide',
  'visual-reference-pack',
  'render-guide-review-decision',
  'rendered-asset-manifest',
  'lettering-map',
  'qa-report',
];

/**
 * @param {number[]} values
 * @returns {number}
 */
function average(values) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * @param {any[]} qaReports
 * @returns {any | null}
 */
function selectPrimaryQaReport(qaReports) {
  return qaReports.find((qaReport) => qaReport.subjectType === 'workflow-run')
    ?? qaReports.at(-1)
    ?? null;
}

/**
 * @param {any[]} qaReports
 * @param {any} diseasePacket
 * @param {any | undefined} evaluationSummary
 * @param {Array<{ artifactType: string, artifactId?: string, payload?: any }>} artifactManifest
 * @returns {{ medicalAccuracy: number, evidenceTraceability: number, mysteryIntegrity: number, educationalSequencing: number, panelization: number, renderReadiness: number, renderingGuideQuality: number, renderOutputQuality: number, sourceFreshness: number, contradictionStatus: string, releaseVerdict: string }}
 */
function buildQualitySummary(qaReports, diseasePacket, evaluationSummary, artifactManifest) {
  const primaryQaReport = selectPrimaryQaReport(qaReports);
  const medicalAccuracyScores = qaReports.map((qaReport) => qaReport.scores.medicalAccuracy);
  const mysteryIntegrityScores = qaReports.map((qaReport) => qaReport.scores.mysteryIntegrity);
  const educationalSequencingScores = qaReports.map((qaReport) => qaReport.scores.educationalSequencing);
  const panelizationScores = qaReports.map((qaReport) => qaReport.scores.panelization);
  const renderReadinessScores = qaReports.map((qaReport) => qaReport.scores.renderReadiness);
  const hasRenderedManifest = artifactManifest.some((artifact) => artifact.artifactType === 'rendered-asset-manifest');
  const evidenceTraceability = Number((evaluationSummary?.familyScores?.evidence_traceability ?? (
    diseasePacket.evidenceSummary.governanceVerdict === 'approved' ? 1 : 0
  )).toFixed(3));
  const contradictionStatus = diseasePacket.evidenceSummary.blockingContradictions > 0
    ? 'blocking'
    : (diseasePacket.evidenceSummary.contradictionCount > 0 ? 'monitor' : 'none');

  return {
    medicalAccuracy: Number((primaryQaReport?.scores.medicalAccuracy ?? average(medicalAccuracyScores)).toFixed(3)),
    evidenceTraceability,
    mysteryIntegrity: Number((primaryQaReport?.scores.mysteryIntegrity ?? average(mysteryIntegrityScores)).toFixed(3)),
    educationalSequencing: Number((primaryQaReport?.scores.educationalSequencing ?? average(educationalSequencingScores)).toFixed(3)),
    panelization: Number((primaryQaReport?.scores.panelization ?? average(panelizationScores)).toFixed(3)),
    renderReadiness: Number((primaryQaReport?.scores.renderReadiness ?? average(renderReadinessScores)).toFixed(3)),
    renderingGuideQuality: Number((evaluationSummary?.familyScores?.rendering_guide_quality ?? 0).toFixed(3)),
    renderOutputQuality: Number(((hasRenderedManifest ? evaluationSummary?.familyScores?.render_output_quality : 0) ?? 0).toFixed(3)),
    sourceFreshness: Number(diseasePacket.evidenceSummary.freshnessScore.toFixed(3)),
    contradictionStatus,
    releaseVerdict: contradictionStatus === 'blocking' || qaReports.some((qaReport) => qaReport.verdict === 'fail')
      ? 'rejected'
      : (qaReports.some((qaReport) => qaReport.verdict === 'conditional-pass') ? 'conditional' : 'approved'),
  };
}

/**
 * @param {any[]} artifactManifest
 * @returns {boolean}
 */
function releaseUsesStubRenderedOutput(artifactManifest) {
  return artifactManifest.some((artifact) => (
    artifact.artifactType === 'rendered-asset-manifest'
    && (artifact.payload?.renderMode === 'stub-placeholder' || artifact.payload?.nonFinalPlaceholder === true)
  ));
}

/**
 * @param {any} workflowRun
 * @param {Array<{ artifactType: string, artifactId?: string, payload?: any }>} artifactManifest
 * @param {any[]} qaReports
 * @param {any} diseasePacket
 * @returns {Array<{ name: string, status: string, details: string }>}
 */
function buildReleaseGateChecks(workflowRun, artifactManifest, qaReports, diseasePacket) {
  const missingArtifactTypes = REQUIRED_RELEASE_ARTIFACT_TYPES.filter(
    (artifactType) => !artifactManifest.some((/** @type {{ artifactType: string }} */ artifact) => artifact.artifactType === artifactType),
  );
  const allRequiredApprovalsPresent = workflowRun.requiredApprovalRoles.every((/** @type {string} */ role) => workflowRun.approvals.some(
    (/** @type {{ role: string, decision: string, reviewerId?: string }} */ approval) => (
      approval.role === role && approval.decision === 'approved' && typeof approval.reviewerId === 'string'
    ),
  ));
  const noQaFailures = qaReports.every((qaReport) => qaReport.verdict !== 'fail');
  const noBlockingContradictions = diseasePacket.evidenceSummary.blockingContradictions === 0;
  const hasRenderedManifest = artifactManifest.some((artifact) => artifact.artifactType === 'rendered-asset-manifest');
  const renderingGuideArtifact = artifactManifest.filter((artifact) => artifact.artifactType === 'rendering-guide').at(-1);
  const visualReferencePackArtifact = artifactManifest.filter((artifact) => artifact.artifactType === 'visual-reference-pack').at(-1);
  const reviewDecisionArtifact = artifactManifest.filter((artifact) => artifact.artifactType === 'render-guide-review-decision').at(-1);
  const renderedManifestArtifact = artifactManifest.filter((artifact) => artifact.artifactType === 'rendered-asset-manifest').at(-1);
  const renderingGuide = renderingGuideArtifact?.payload;
  const visualReferencePack = visualReferencePackArtifact?.payload;
  const reviewDecision = reviewDecisionArtifact?.payload;
  const renderedManifest = renderedManifestArtifact?.payload;
  const guideApprovalCurrent = Boolean(
    renderingGuide
    && visualReferencePack
    && reviewDecision
    && renderingGuide.reviewStatus === 'approved'
    && visualReferencePack.approvalStatus === 'approved'
    && reviewDecision.decision === 'approved'
    && renderingGuide.visualReferencePackId === visualReferencePack.id
    && reviewDecision.renderingGuideId === renderingGuide.id
    && reviewDecision.visualReferencePackId === visualReferencePack.id,
  );
  const renderedManifestCurrent = Boolean(
    renderedManifest
    && renderedManifest.allPanelsRendered
    && renderedManifest.renderingGuideId === renderingGuide?.id
    && renderedManifest.visualReferencePackId === visualReferencePack?.id,
  );

  const gateChecks = [
    {
      name: 'required-approvals',
      status: allRequiredApprovalsPresent ? 'passed' : 'failed',
      details: allRequiredApprovalsPresent
        ? 'Clinical, editorial, and product approvals were recorded.'
        : 'One or more required approvals were missing at export time.',
    },
    {
      name: 'artifact-completeness',
      status: missingArtifactTypes.length === 0 ? 'passed' : 'failed',
      details: missingArtifactTypes.length === 0
        ? 'All required release artifacts were present.'
        : `Missing artifact types: ${missingArtifactTypes.join(', ')}.`,
    },
    {
      name: 'quality-blockers',
      status: noQaFailures ? 'passed' : 'failed',
      details: noQaFailures
        ? 'No QA report returned a fail verdict.'
        : 'At least one QA report remained in a fail state.',
    },
    {
      name: 'rendered-output',
      status: hasRenderedManifest && renderedManifest?.allPanelsRendered ? 'passed' : 'failed',
      details: hasRenderedManifest
        ? `Rendered asset manifest ${renderedManifestArtifact?.artifactId ?? 'manifest'} ${renderedManifest?.allPanelsRendered ? 'covers every required panel' : 'does not cover every required panel'}.`
        : 'Export requires a rendered asset manifest because panel images are now the default end product.',
    },
    {
      name: 'rendering-guide-approval',
      status: guideApprovalCurrent ? 'passed' : 'failed',
      details: guideApprovalCurrent
        ? `Rendering guide ${renderingGuide.id} and visual reference pack ${visualReferencePack.id} were approved before rendering.`
        : 'The latest rendering guide and visual reference pack must have a current approved review decision before export.',
    },
    {
      name: 'rendered-output-provenance',
      status: renderedManifestCurrent ? 'passed' : 'failed',
      details: renderedManifestCurrent
        ? 'Rendered assets were generated from the latest approved rendering guide and visual reference pack.'
        : 'Rendered assets must reference the latest approved rendering guide and visual reference pack.',
    },
    {
      name: 'source-governance',
      status: noBlockingContradictions ? 'passed' : 'failed',
      details: noBlockingContradictions
        ? 'No blocking evidence contradictions remained in the disease packet.'
        : 'Blocking evidence contradictions must be resolved before export.',
    },
  ];

  return gateChecks;
}

/**
 * @param {any} releaseBundle
 * @param {any} workflowRun
 * @param {string} projectTitle
 * @returns {string}
 */
export function renderReleaseBundleIndex(releaseBundle, workflowRun, projectTitle) {
  return `# Release Bundle ${releaseBundle.releaseId}

- Project: ${projectTitle}
- Workflow run: ${workflowRun.id}
- Tenant: ${releaseBundle.tenantId}
- Exported by: ${releaseBundle.exportedBy}
- Exported at: ${releaseBundle.exportedAt}
- Release verdict: ${releaseBundle.qualitySummary.releaseVerdict}
- Rendering guide: ${releaseBundle.renderingGuideId ?? 'not-attached'}
- Visual reference pack: ${releaseBundle.visualReferencePackId ?? 'not-attached'}
- Render guide review decision: ${releaseBundle.renderGuideReviewDecisionId ?? 'not-attached'}
- Rendered asset manifest: ${releaseBundle.renderedAssetManifestId ?? 'not-attached'}
${releaseBundle.evaluationSummary ? `- Eval run: ${releaseBundle.evaluationSummary.evalRunId}
- Eval status: ${releaseBundle.evaluationSummary.allThresholdsMet ? 'passed' : 'failed'}
- Eval timestamp: ${releaseBundle.evaluationSummary.evaluatedAt}` : ''}

## Gate Checks
${releaseBundle.releaseGateChecks.map((/** @type {{ name: string, status: string, details?: string }} */ gateCheck) => `- ${gateCheck.name}: ${gateCheck.status} (${gateCheck.details})`).join('\n')}

## Artifact Manifest
${releaseBundle.artifactManifest.map((/** @type {{ artifactType: string, artifactId: string, location: string }} */ artifact) => `- ${artifact.artifactType}: ${artifact.artifactId} -> ${artifact.location}`).join('\n')}

## Approvals
${releaseBundle.approvals.map((/** @type {{ role: string, decision: string, reviewerId?: string }} */ approval) => `- ${approval.role}: ${approval.decision} by ${approval.reviewerId}`).join('\n')}
`;
}

/**
 * @param {any} diseasePacket
 * @returns {any}
 */
export function buildSourceEvidencePack(diseasePacket) {
  return {
    schemaVersion: '1.0.0',
    canonicalDiseaseName: diseasePacket.canonicalDiseaseName,
    sourceSetHash: diseasePacket.sourceSetHash,
    evidenceSummary: diseasePacket.evidenceSummary,
    evidence: diseasePacket.evidence.map((/** @type {{ claimId: string, sourceId: string, sourceLabel: string, sourceType: string, sourceLocator: string, freshnessStatus: string, contradictionStatus: string, approvalStatus: string }} */ evidenceRecord) => ({
      claimId: evidenceRecord.claimId,
      sourceId: evidenceRecord.sourceId,
      sourceLabel: evidenceRecord.sourceLabel,
      sourceType: evidenceRecord.sourceType,
      sourceLocator: evidenceRecord.sourceLocator,
      freshnessStatus: evidenceRecord.freshnessStatus,
      contradictionStatus: evidenceRecord.contradictionStatus,
      approvalStatus: evidenceRecord.approvalStatus,
    })),
  };
}

export class ExporterService {
  /**
   * @param {{
   *   workflowRun: any,
   *   project: any,
   *   actor: any,
   *   diseasePacket: any,
   *   qaReports: any[],
   *   artifactManifest: Array<{ artifactType: string, artifactId: string, location: string, checksum: string, contentType: string, retentionClass: string }>,
   *   evaluationSummary?: any,
   *   exportTargets?: string[],
   *   version?: string,
   *   allowEvaluationBypass?: boolean,
   * }} options
   * @returns {{ releaseBundle: any, bundleIndexMarkdown: string, sourceEvidencePack: any, exportHistoryEntry: any }}
   */
  assembleRelease(options) {
    if (options.workflowRun.state !== 'approved') {
      throw new Error('Workflow run must be approved before export can begin.');
    }

    const releaseGateChecks = buildReleaseGateChecks(
      options.workflowRun,
      options.artifactManifest,
      options.qaReports,
      options.diseasePacket,
    );
    const failedGateCheck = releaseGateChecks.find((gateCheck) => gateCheck.status === 'failed');

    if (failedGateCheck) {
      throw new Error(`Release gate failed: ${failedGateCheck.name}. ${failedGateCheck.details}`);
    }

    if (!options.allowEvaluationBypass) {
      if (!options.evaluationSummary) {
        throw new Error('Release gate failed: evaluation-status. A fresh passing eval run is required before export.');
      }

      if (!options.evaluationSummary.allThresholdsMet) {
        throw new Error('Release gate failed: evaluation-status. The latest eval run did not meet all configured thresholds.');
      }
    }

    const exportedAt = new Date().toISOString();
    const releaseId = createId('rel');
    const releaseBundle = {
      schemaVersion: '1.0.0',
      releaseId,
      workflowRunId: options.workflowRun.id,
      tenantId: options.workflowRun.tenantId,
      version: options.version ?? `${options.workflowRun.id}-v1`,
      artifactManifest: options.artifactManifest.map((artifact) => ({
        artifactType: artifact.artifactType,
        artifactId: artifact.artifactId,
        location: artifact.location,
        contentType: artifact.contentType,
        retentionClass: artifact.retentionClass,
        checksum: artifact.checksum,
      })),
      qualitySummary: buildQualitySummary(options.qaReports, options.diseasePacket, options.evaluationSummary, options.artifactManifest),
      releaseGateChecks: options.evaluationSummary
        ? [
          ...releaseGateChecks,
          {
            name: 'evaluation-status',
            status: options.evaluationSummary.allThresholdsMet ? 'passed' : 'failed',
            details: options.evaluationSummary.allThresholdsMet
              ? `Eval run ${options.evaluationSummary.evalRunId} passed all applicable thresholds.`
              : `Eval run ${options.evaluationSummary.evalRunId} did not pass all applicable thresholds.`,
          },
        ]
        : releaseGateChecks,
      evaluationSummary: options.evaluationSummary,
      approvals: options.workflowRun.approvals.filter((/** @type {{ decision: string }} */ approval) => approval.decision === 'approved'),
      exportTargets: options.exportTargets ?? ['json', 'human-readable-bundle'],
      exportedAt,
      exportedBy: options.actor.id,
      bundleIndexLocation: '',
      sourceEvidencePackLocation: '',
      renderingGuideId: options.artifactManifest.find((artifact) => artifact.artifactType === 'rendering-guide')?.artifactId,
      renderingGuideLocation: options.artifactManifest.find((artifact) => artifact.artifactType === 'rendering-guide')?.location,
      visualReferencePackId: options.artifactManifest.find((artifact) => artifact.artifactType === 'visual-reference-pack')?.artifactId,
      renderGuideReviewDecisionId: options.artifactManifest.find((artifact) => artifact.artifactType === 'render-guide-review-decision')?.artifactId,
      renderingGuideMarkdownDocumentId: undefined,
      renderingGuideMarkdownLocation: undefined,
      renderedAssetManifestId: options.artifactManifest.find((artifact) => artifact.artifactType === 'rendered-asset-manifest')?.artifactId,
      renderedAssetManifestLocation: options.artifactManifest.find((artifact) => artifact.artifactType === 'rendered-asset-manifest')?.location,
      notes: [
        'Release assembled from an approved workflow run.',
        ...(releaseUsesStubRenderedOutput(options.artifactManifest)
          ? ['Rendered asset manifest was produced by the local stub provider. This validates local structure and gating only; final image quality still requires live OpenAI rendering.']
          : []),
      ],
    };
    const bundleIndexMarkdown = renderReleaseBundleIndex(releaseBundle, options.workflowRun, options.project.title);
    const sourceEvidencePack = buildSourceEvidencePack(options.diseasePacket);
    const exportHistoryEntry = {
      schemaVersion: '1.0.0',
      id: createId('exp'),
      releaseId,
      workflowRunId: options.workflowRun.id,
      tenantId: options.workflowRun.tenantId,
      exportedBy: options.actor.id,
      exportedAt,
      status: 'completed',
      bundleLocation: '',
      bundleIndexLocation: '',
      exportTargets: releaseBundle.exportTargets,
    };

    return {
      releaseBundle,
      bundleIndexMarkdown,
      sourceEvidencePack,
      exportHistoryEntry,
    };
  }
}

export function createExporterService() {
  return new ExporterService();
}
