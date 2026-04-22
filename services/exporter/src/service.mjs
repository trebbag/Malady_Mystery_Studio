import { createId } from '../../../packages/shared-config/src/ids.mjs';

const REQUIRED_RELEASE_ARTIFACT_TYPES = [
  'disease-packet',
  'story-workbook',
  'scene-card',
  'panel-plan',
  'render-prompt',
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
 * @returns {{ medicalAccuracy: number, mysteryIntegrity: number, educationalSequencing: number, panelization: number, renderReadiness: number, sourceFreshness: number, contradictionStatus: string, releaseVerdict: string }}
 */
function buildQualitySummary(qaReports, diseasePacket) {
  const primaryQaReport = selectPrimaryQaReport(qaReports);
  const medicalAccuracyScores = qaReports.map((qaReport) => qaReport.scores.medicalAccuracy);
  const mysteryIntegrityScores = qaReports.map((qaReport) => qaReport.scores.mysteryIntegrity);
  const educationalSequencingScores = qaReports.map((qaReport) => qaReport.scores.educationalSequencing);
  const panelizationScores = qaReports.map((qaReport) => qaReport.scores.panelization);
  const renderReadinessScores = qaReports.map((qaReport) => qaReport.scores.renderReadiness);
  const contradictionStatus = diseasePacket.evidenceSummary.blockingContradictions > 0
    ? 'blocking'
    : (diseasePacket.evidenceSummary.contradictionCount > 0 ? 'monitor' : 'none');

  return {
    medicalAccuracy: Number((primaryQaReport?.scores.medicalAccuracy ?? average(medicalAccuracyScores)).toFixed(3)),
    mysteryIntegrity: Number((primaryQaReport?.scores.mysteryIntegrity ?? average(mysteryIntegrityScores)).toFixed(3)),
    educationalSequencing: Number((primaryQaReport?.scores.educationalSequencing ?? average(educationalSequencingScores)).toFixed(3)),
    panelization: Number((primaryQaReport?.scores.panelization ?? average(panelizationScores)).toFixed(3)),
    renderReadiness: Number((primaryQaReport?.scores.renderReadiness ?? average(renderReadinessScores)).toFixed(3)),
    sourceFreshness: Number(diseasePacket.evidenceSummary.freshnessScore.toFixed(3)),
    contradictionStatus,
    releaseVerdict: contradictionStatus === 'blocking' || qaReports.some((qaReport) => qaReport.verdict === 'fail')
      ? 'rejected'
      : (qaReports.some((qaReport) => qaReport.verdict === 'conditional-pass') ? 'conditional' : 'approved'),
  };
}

/**
 * @param {any} workflowRun
 * @param {Array<{ artifactType: string }>} artifactManifest
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

  return [
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
      name: 'source-governance',
      status: noBlockingContradictions ? 'passed' : 'failed',
      details: noBlockingContradictions
        ? 'No blocking evidence contradictions remained in the disease packet.'
        : 'Blocking evidence contradictions must be resolved before export.',
    },
  ];
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
   *   exportTargets?: string[],
   *   version?: string,
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
      qualitySummary: buildQualitySummary(options.qaReports, options.diseasePacket),
      releaseGateChecks,
      approvals: options.workflowRun.approvals.filter((/** @type {{ decision: string }} */ approval) => approval.decision === 'approved'),
      exportTargets: options.exportTargets ?? ['json', 'human-readable-bundle'],
      exportedAt,
      exportedBy: options.actor.id,
      bundleIndexLocation: '',
      sourceEvidencePackLocation: '',
      notes: [
        'Release assembled from an approved workflow run.',
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
