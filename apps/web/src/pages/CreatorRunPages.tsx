import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { SectionStack } from '@/components/StatePanel';
import { StatusPill } from '@/components/StatusPill';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  approveKnowledgePack,
  createRenderJob,
  exportBundle,
  fetchLocalOpsStatus,
  fetchRenderingGuideView,
  fetchReviewRunView,
  fetchSourceOps,
  fetchWorkflowArtifacts,
  mirrorReleaseBundleLocal,
  promoteKnowledgePack,
  regenerateKnowledgePack,
  regenerateRenderingGuide,
  regenerateVisualReferencePack,
  runMedicalResearchAgents,
  runEvaluations,
  submitApproval,
  submitMedicalDossierReviewDecision,
  submitRenderingGuideReviewDecision,
  verifyReleaseBundleLocalMirror,
} from '@/lib/api';
import { useRefreshSignal } from '@/lib/refresh-context';
import type { CreatorWorkflow, EvaluationFamilyResult, RenderJob, ReviewRunView } from '@/lib/types';
import { useRemoteData } from '@/lib/use-remote-data';
import { cn, formatDateTime, titleFromSlug } from '@/lib/utils';
import { useRunPageContext } from '@/pages/RunLayout';

function useReviewRunState() {
  const { runId } = useRunPageContext();
  const refreshSignal = useRefreshSignal(runId);

  return useRemoteData(() => fetchReviewRunView(runId), [runId, refreshSignal]);
}

function workflowFrom(view?: ReviewRunView | null): CreatorWorkflow | null {
  return view?.creatorWorkflow ?? null;
}

function LinkButton({ to, children, variant = 'primary' }: { to: string; children: string; variant?: 'primary' | 'secondary' }) {
  return (
    <Link
      to={to}
      className={cn(
        'inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition',
        variant === 'primary' ? 'bg-accent-500 text-shell-950 hover:bg-accent-300' : 'bg-shell-800 text-white hover:bg-shell-700',
      )}
    >
      {children}
    </Link>
  );
}

function WorkflowStepper({ workflow }: { workflow: CreatorWorkflow }) {
  return (
    <Card>
      <CardTitle>Production path</CardTitle>
      <CardDescription>One calm path from disease intake to local export.</CardDescription>
      <div className="mt-5 grid gap-3 lg:grid-cols-6">
        {workflow.steps.map((step, index) => (
          <Link
            key={step.id}
            to={step.targetPath}
            className={cn(
              'rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-panel',
              step.status === 'complete' ? 'border-emerald-200 bg-emerald-50 text-emerald-950' : '',
              step.status === 'current' ? 'border-accent-300 bg-accent-50 text-shell-950' : '',
              step.status === 'blocked' ? 'border-red-300 bg-red-50 text-red-950' : '',
              step.status === 'ready' ? 'border-slate-300 bg-white text-shell-950' : '',
              step.status === 'waiting' ? 'border-black/10 bg-slate-50 text-slate-600' : '',
            )}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.16em]">Step {index + 1}</p>
            <p className="mt-2 text-sm font-semibold">{step.label}</p>
            <p className="mt-2 text-xs leading-5">{step.description}</p>
            <StatusPill label={step.status} className="mt-3" />
          </Link>
        ))}
      </div>
    </Card>
  );
}

function BlockerList({ workflow }: { workflow: CreatorWorkflow }) {
  if (workflow.blockers.length === 0) {
    return <Alert tone="success">No blocking issues are currently recorded for this run.</Alert>;
  }

  return (
    <div className="grid gap-3">
      {workflow.blockers.map((blocker, index) => (
        <Alert key={`${blocker.title}.${index}`} tone={blocker.severity === 'critical' ? 'critical' : 'warning'}>
          <p className="font-semibold">{blocker.title}</p>
          <p className="mt-1">{blocker.detail}</p>
        </Alert>
      ))}
    </div>
  );
}

function PrimaryActionCard({ workflow }: { workflow: CreatorWorkflow }) {
  return (
    <Card className="border-accent-200 bg-accent-50/90">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-shell-700">Next best action</p>
      <CardTitle className="mt-2 text-2xl">{workflow.primaryAction.label}</CardTitle>
      <CardDescription className="mt-2">{workflow.friendlyStatus}</CardDescription>
      {workflow.primaryAction.disabledReason ? (
        <Alert tone="warning" className="mt-4">{workflow.primaryAction.disabledReason}</Alert>
      ) : null}
      <div className="mt-4">
        <LinkButton to={workflow.primaryAction.targetPath}>{workflow.primaryAction.label}</LinkButton>
      </div>
    </Card>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white/75 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 break-words text-lg font-semibold text-shell-950">{value}</p>
      {detail ? <p className="mt-1 text-xs text-slate-500">{detail}</p> : null}
    </div>
  );
}

function PageCoach({
  title,
  checks,
  nextStep,
  blockedHint,
}: {
  title: string;
  checks: string[];
  nextStep: string;
  blockedHint?: string;
}) {
  return (
    <Card className="border-sky-100 bg-sky-50/90">
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-800">How to use this page</p>
          <CardTitle className="mt-2 text-xl">{title}</CardTitle>
        </div>
        <div>
          <p className="text-sm font-semibold text-shell-950">Check first</p>
          <ul className="mt-2 space-y-1 text-sm leading-6 text-slate-700">
            {checks.map((check) => <li key={check}>{check}</li>)}
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-shell-950">Then</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{nextStep}</p>
          {blockedHint ? <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">{blockedHint}</p> : null}
        </div>
      </div>
    </Card>
  );
}

function AdvancedDetails({ workflow, defaultOpen = false }: { workflow: CreatorWorkflow; defaultOpen?: boolean }) {
  return (
    <Card>
      <details open={defaultOpen}>
        <summary className="cursor-pointer list-none">
          <CardTitle>Advanced details</CardTitle>
          <CardDescription className="mt-2">Open these only when you need the full technical artifact views.</CardDescription>
        </summary>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {workflow.advancedLinks.map((link) => (
            <Link key={link.path} to={link.path} className="rounded-2xl border border-black/10 bg-slate-50 p-4 transition hover:bg-white hover:shadow-panel">
              <p className="text-sm font-semibold text-shell-950">{link.label}</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">{link.description}</p>
            </Link>
          ))}
        </div>
      </details>
    </Card>
  );
}

function latestReleaseId(view: ReviewRunView) {
  return view.exportHistory.entries.at(-1)?.releaseId;
}

function renderManifestPresent(view: ReviewRunView) {
  return (view.renderJobs ?? []).some((renderJob) => Boolean(renderJob.renderedAssetManifestId));
}

function latestArtifactPayload(artifacts: Array<{ artifactType: string; payload?: Record<string, unknown> }> | undefined, artifactType: string) {
  return artifacts?.filter((artifact) => artifact.artifactType === artifactType).at(-1)?.payload ?? {};
}

function asRecordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item)) : [];
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function gateStatusFrom(payload: Record<string, unknown>) {
  return String(payload.gateStatus ?? 'pending');
}

export function CreatorRunOverviewPage() {
  const { workflowRun } = useRunPageContext();
  const reviewState = useReviewRunState();
  const workflow = workflowFrom(reviewState.data);

  return (
    <SectionStack>
      <PageHeader
        eyebrow="Run overview"
        title={workflowRun.input.diseaseName}
        description="A plain-language control room for this disease comic run."
      />
      {workflow ? (
        <>
          <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
            <PrimaryActionCard workflow={workflow} />
            <Card>
              <CardTitle>What is happening?</CardTitle>
              <CardDescription className="mt-2">{workflow.friendlyStatus}</CardDescription>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Metric label="Current step" value={titleFromSlug(workflow.activeStep)} />
                <Metric label="Run state" value={titleFromSlug(workflowRun.state)} />
                <Metric label="Safety checks" value={workflowRun.latestEvalStatus ?? 'missing'} />
                <Metric label="Approvals" value={`${workflowRun.approvals.filter((approval) => approval.decision === 'approved').length}/${workflowRun.requiredApprovalRoles.length}`} detail="required roles" />
              </div>
            </Card>
          </div>
          <WorkflowStepper workflow={workflow} />
          <BlockerList workflow={workflow} />
          <AdvancedDetails workflow={workflow} />
        </>
      ) : (
        <Alert tone="info">Loading the creator workflow for this run.</Alert>
      )}
    </SectionStack>
  );
}

export function CreatorStoryPanelPlanPage() {
  const { runId } = useRunPageContext();
  const refreshSignal = useRefreshSignal(runId);
  const artifactsState = useRemoteData(
    () => fetchWorkflowArtifacts(
      runId,
      ['story-workbook', 'story-craft-report', 'panel-adaptation-report', 'scene-card', 'panel-plan', 'qa-report'],
      true,
    ),
    [runId, refreshSignal],
  );
  const artifacts = artifactsState.data?.artifacts;
  const storyReport = latestArtifactPayload(artifacts, 'story-craft-report');
  const panelReport = latestArtifactPayload(artifacts, 'panel-adaptation-report');
  const panelPlan = latestArtifactPayload(artifacts, 'panel-plan');
  const panels = asRecordArray(panelPlan.panels);
  const sceneMap = asRecordArray(panelReport.sceneMap);
  const beatMap = asRecordArray(panelReport.beatMap);
  const storyFindings = asRecordArray(storyReport.findings);
  const panelFindings = asRecordArray(panelReport.findings);
  const blockingFindings = [...storyFindings, ...panelFindings].filter((finding) => ['critical', 'blocking'].includes(String(finding.severity)) && String(finding.status) !== 'passed');

  return (
    <SectionStack>
      <PageHeader
        eyebrow="Story and panels"
        title="Check the story plan before visual approval"
        description="A summary-first view of the mystery craft, page rhythm, panel order, and continuity plan."
        actions={<LinkButton to={`/runs/${encodeURIComponent(runId)}/advanced/panels`} variant="secondary">Open technical panels</LinkButton>}
      />
      <PageCoach
        title="Make sure the story earns the diagnosis visually."
        checks={[
          'The mystery has a fair clue chain before the reveal.',
          'Every panel creates one useful story or medical change.',
          'Continuity notes cover characters, props, setting, and medical devices.',
        ]}
        nextStep="If story craft and panel adaptation pass, move to Guide Review to approve the visual references and final image prompts."
        blockedHint="If a blocking finding appears here, regenerate or repair story/panel artifacts before approving the render guide."
      />
      {artifactsState.loading ? <Alert tone="info">Loading story and panel plan.</Alert> : null}
      {artifactsState.error ? <Alert tone="critical">{artifactsState.error.message}</Alert> : null}
      {blockingFindings.length > 0 ? (
        <div className="grid gap-3">
          {blockingFindings.map((finding, index) => (
            <Alert key={`${String(finding.ruleId ?? 'finding')}.${index}`} tone="critical">
              <p className="font-semibold">{String(finding.ruleId ?? 'Blocking story/panel finding')}</p>
              <p className="mt-1">{String(finding.message ?? 'Review this finding before continuing.')}</p>
            </Alert>
          ))}
        </div>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardTitle>Mystery craft</CardTitle>
          <CardDescription>{String(storyReport.centralCaseQuestion ?? 'Story craft report has not been generated yet.')}</CardDescription>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Metric label="Story gate" value={titleFromSlug(gateStatusFrom(storyReport))} />
            <Metric label="Clues" value={String(asRecordArray(storyReport.clueLedger).length)} />
            <Metric label="Proof points" value={String(asRecordArray(storyReport.fairRevealProofChain).length)} />
            <Metric label="Repair ending" value={storyReport.repairCodaPlan ? 'Planned' : 'Missing'} />
          </div>
          {storyReport.beforeCaseBaseline ? <p className="mt-4 text-sm leading-6 text-slate-700">{String(storyReport.beforeCaseBaseline)}</p> : null}
        </Card>
        <Card>
          <CardTitle>Panel adaptation</CardTitle>
          <CardDescription>{String(panelReport.storySpine ?? 'Panel adaptation report has not been generated yet.')}</CardDescription>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Metric label="Panel gate" value={titleFromSlug(gateStatusFrom(panelReport))} />
            <Metric label="Scenes" value={String(sceneMap.length)} />
            <Metric label="Beats" value={String(beatMap.length)} />
            <Metric label="Panels" value={String(panels.length)} />
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-700">
            Continuity: {Object.entries((panelReport.continuityLedger as Record<string, unknown> | undefined) ?? {})
              .map(([key, value]) => `${titleFromSlug(key)} ${asStringArray(value).length}`)
              .join(' · ') || 'pending'}
          </p>
        </Card>
      </div>
      <Card>
        <CardTitle>Panel checklist</CardTitle>
        <CardDescription>Skim the panel order and make sure each one has a clear purpose before approving visual prompts.</CardDescription>
        <div className="mt-4 grid gap-3">
          {panels.length === 0 ? <Alert tone="info">No panel plan is available yet.</Alert> : panels.map((panel) => (
            <div key={String(panel.panelId)} className="rounded-2xl border border-black/10 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-shell-950">{String(panel.panelId)} · page {String(panel.pageNumber ?? '?')}</p>
                  <p className="mt-1 text-sm text-slate-600">{String(panel.storyFunction ?? 'Story function pending')}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge>{asStringArray(panel.linkedClaimIds).length} claims</Badge>
                  <Badge>{asStringArray(panel.continuityAnchors).length} continuity anchors</Badge>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-700">{String(panel.medicalObjective ?? panel.beatGoal ?? 'Panel objective pending')}</p>
            </div>
          ))}
        </div>
      </Card>
    </SectionStack>
  );
}

export function CreatorClinicalReviewPage() {
  const { runId, workflowRun, refreshRun } = useRunPageContext();
  const reviewState = useReviewRunState();
  const view = reviewState.data;
  const [notice, setNotice] = useState<string | null>(null);
  const medicalDossier = view?.medicalDossier;
  const medicalSections = (medicalDossier?.sections ?? {}) as Record<string, { title?: string; summary?: string; linkedClaimIds?: string[] }>;
  const medicalQa = view?.medicalDossierQaReport;
  const diseasePacket = view?.clinicalPackage?.diseasePacket ?? {};
  const traceCoverage = view?.clinicalPackage?.traceCoverage;
  const sources = view?.clinicalPackage?.sourceGovernance.sourceRecords ?? [];
  const missingApprovalRoles = workflowRun.requiredApprovalRoles.filter((role) => !workflowRun.approvals.some((approval) => approval.role === role && approval.decision === 'approved'));

  return (
    <SectionStack>
      <PageHeader
        eyebrow="Medical review"
        title="Approve the disease research before the story starts"
        description="The app first compiles a high-yield medical dossier. Approve it before the disease is reframed as the mystery culprit."
      />
      <PageCoach
        title="Start with the medical dossier, then the clinical package."
        checks={[
          'Epidemiology, etiology, pathophysiology, presentation, diagnostics, treatment, complications, and prognosis are covered.',
          'Every clinically meaningful point is linked to source-backed claims.',
          'The dossier is approved before story, panels, guide, render, eval, or export work continues.',
        ]}
        nextStep="Approve the dossier to unlock the mystery story transformation, or request changes and rerun research agents."
        blockedHint="The story pipeline is intentionally paused until this medical dossier is approved."
      />
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {view?.creatorWorkflow ? <BlockerList workflow={view.creatorWorkflow} /> : null}
      <Card className="border-sky-200 bg-sky-50/80">
        <CardTitle>Medical dossier review gate</CardTitle>
        <CardDescription>
          {medicalDossier
            ? `Agent-built dossier for ${String(medicalDossier.canonicalDiseaseName ?? view?.diseaseName ?? workflowRun.input.diseaseName)}.`
            : 'No medical dossier is stored yet. Run the research agents before story generation.'}
        </CardDescription>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <Metric label="Dossier status" value={String(medicalDossier?.reviewStatus ?? 'missing')} />
          <Metric label="Sections" value={`${String((medicalDossier?.completeness as Record<string, unknown> | undefined)?.completedSectionCount ?? 0)}/${String((medicalDossier?.completeness as Record<string, unknown> | undefined)?.requiredSectionCount ?? 16)}`} />
          <Metric label="Traceability" value={`${Math.round(Number((medicalDossier?.completeness as Record<string, unknown> | undefined)?.traceabilityScore ?? 0) * 100)}%`} />
          <Metric label="Agent runs" value={String(view?.agentRuns?.length ?? 0)} />
        </div>
        {medicalQa ? (
          <div className="mt-4">
            <Alert tone={String(medicalQa.status) === 'failed' ? 'critical' : 'warning'}>
              <p className="font-semibold">Dossier QA: {titleFromSlug(String(medicalQa.status ?? 'review-required'))}</p>
              <p className="mt-1">{asStringArray(medicalQa.warnings).at(0) ?? 'Reviewer approval is required before story generation.'}</p>
            </Alert>
          </div>
        ) : null}
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Object.entries(medicalSections).slice(0, 16).map(([sectionKey, section]) => (
            <div key={sectionKey} className="rounded-2xl border border-black/10 bg-white/80 p-4">
              <p className="text-sm font-semibold text-shell-950">{section.title ?? titleFromSlug(sectionKey)}</p>
              <p className="mt-2 line-clamp-4 text-xs leading-5 text-slate-600">{section.summary ?? 'Section summary pending.'}</p>
              <Badge className="mt-3">{section.linkedClaimIds?.length ?? 0} claims</Badge>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void runMedicalResearchAgents(runId).then(() => {
            setNotice('Medical research agents reran and paused for dossier review.');
            refreshRun();
          })}>
            Rerun research agents
          </Button>
          <Button onClick={() => void submitMedicalDossierReviewDecision(runId, { decision: 'approved', notes: 'Approved from the simplified medical review page.' }).then(() => {
            setNotice('Medical dossier approved. The app can now build the clinical package and story pipeline.');
            refreshRun();
          })}>
            Approve medical dossier
          </Button>
          <Button variant="secondary" onClick={() => void submitMedicalDossierReviewDecision(runId, { decision: 'request-changes', notes: 'Changes requested from the simplified medical review page.' }).then(() => {
            setNotice('Medical dossier changes requested.');
            refreshRun();
          })}>
            Request changes
          </Button>
        </div>
      </Card>
      <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <Card>
          <CardTitle>Disease packet summary</CardTitle>
          <CardDescription>{String(diseasePacket.canonicalDiseaseName ?? view?.diseaseName ?? 'Disease packet not ready yet.')}</CardDescription>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Metric label="Clinical decision" value={String((diseasePacket.evidenceSummary as Record<string, unknown> | undefined)?.governanceVerdict ?? 'pending')} />
            <Metric label="Trace coverage" value={traceCoverage ? `${Math.round(traceCoverage.score * 100)}%` : 'pending'} />
            <Metric label="Valid claims" value={String(traceCoverage?.validClaimCount ?? 0)} />
          </div>
          {traceCoverage?.blockers.length ? (
            <div className="mt-4 grid gap-2">
              {traceCoverage.blockers.map((blocker) => <Alert key={blocker} tone="critical">{blocker}</Alert>)}
            </div>
          ) : null}
          {!view?.clinicalPackage ? <Alert tone="info" className="mt-4">The disease packet appears after the medical dossier is approved.</Alert> : null}
        </Card>
        <Card>
          <CardTitle>Clinical approvals</CardTitle>
          <CardDescription>Approve only after the evidence and source state are acceptable.</CardDescription>
          <div className="mt-4 grid gap-2">
            {missingApprovalRoles.length === 0 ? <Alert tone="success">All required approval roles are approved.</Alert> : missingApprovalRoles.map((role) => (
              <Button
                key={role}
                onClick={() => void submitApproval(runId, { role, decision: 'approved', comment: 'Approved from the simplified clinical review page.' }).then(() => {
                  setNotice(`${role} approval recorded.`);
                  refreshRun();
                })}
              >
                Approve {titleFromSlug(role)}
              </Button>
            ))}
          </div>
        </Card>
      </div>
      <Card>
        <CardTitle>Provisional disease pack</CardTitle>
        <CardDescription>If this disease was typed freely, approve it for this run or promote it into the local governed library.</CardDescription>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void regenerateKnowledgePack(runId).then(() => {
            setNotice('Knowledge pack rebuilt. Review is required before export.');
            refreshRun();
          })}>
            Rebuild pack
          </Button>
          <Button onClick={() => void approveKnowledgePack(runId, { decision: 'approved', reason: 'Approved from the simplified clinical review page.' }).then(() => {
            setNotice('Knowledge pack approved for this run.');
            refreshRun();
          })}>
            Approve pack for this run
          </Button>
          <Button variant="secondary" onClick={() => void promoteKnowledgePack(runId, { reason: 'Promoted from the simplified clinical review page.' }).then(() => {
            setNotice('Knowledge pack promoted locally.');
            refreshRun();
          })}>
            Promote locally
          </Button>
        </div>
      </Card>
      <Card>
        <CardTitle>Source snapshot</CardTitle>
        <CardDescription>Only the most important source health signals are shown here. Use Sources for full owner/refresh operations.</CardDescription>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sources.slice(0, 6).map((source) => (
            <div key={String(source.id)} className="rounded-2xl border border-black/10 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-shell-950">{String(source.sourceLabel ?? source.id)}</p>
              <p className="mt-1 text-xs text-slate-500">{String(source.primaryOwnerRole ?? 'Owner pending')}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusPill label={String(source.approvalStatus ?? 'pending')} />
                <StatusPill label={String(source.freshnessState ?? source.freshnessStatus ?? 'unknown')} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </SectionStack>
  );
}

export function CreatorGuideReviewPage() {
  const { runId, refreshRun } = useRunPageContext();
  const refreshSignal = useRefreshSignal(runId);
  const guideState = useRemoteData(() => fetchRenderingGuideView(runId), [runId, refreshSignal]);
  const [comment, setComment] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const guide = guideState.data?.renderingGuide;
  const visualItems = guideState.data?.visualReferencePack?.items ?? [];
  const panels = guide?.panels ?? [];
  const characterItems = visualItems.filter((item) => item.itemType === 'character');
  const isApproved = guideState.data?.gateStatus === 'approved';

  const submitDecision = (decision: 'approved' | 'changes-requested' | 'rejected') => {
    void submitRenderingGuideReviewDecision(runId, {
      decision,
      ...(comment.trim() ? { comment: comment.trim() } : {}),
    }).then(() => {
      setComment('');
      setNotice(decision === 'approved' ? 'Guide and visual references approved. Rendering is now available.' : `Guide review saved as ${decision}.`);
      refreshRun();
    });
  };

  return (
    <SectionStack>
      <PageHeader
        eyebrow="Guide review"
        title="Approve the visual plan before rendering"
        description="Review Cyto, Pip, recurring references, panel prompts, and lettering separation before any image call runs."
        actions={<LinkButton to={`/runs/${encodeURIComponent(runId)}/rendering-guide`} variant="secondary">Open full workbench</LinkButton>}
      />
      <PageCoach
        title="Approve the visual plan before any image generation happens."
        checks={[
          'Cyto and Pip have stable character and personality locks.',
          'Recurring props, sets, and anatomy references are represented.',
          'Every panel has references, claim links, and separate lettering.',
        ]}
        nextStep="Approve the guide when the plan is production-ready, or request changes and regenerate the guide/reference pack."
        blockedHint="Panel rendering is intentionally disabled until this guide and reference pack are approved."
      />
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {guideState.data ? (
        <>
          <Alert tone={isApproved ? 'success' : 'warning'}>
            <p className="font-semibold">Pre-render gate: {titleFromSlug(guideState.data.gateStatus)}</p>
            <p className="mt-1">{guideState.data.renderDisabledReason || 'Guide and visual reference provenance are approved.'}</p>
          </Alert>
          <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
            <Card>
              <CardTitle>Review checklist</CardTitle>
              <CardDescription>These are the items that should be understandable before approval.</CardDescription>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Metric label="Cyto/Pip references" value={`${characterItems.length}/2`} detail="Required character locks" />
                <Metric label="Panels" value={String(panels.length)} detail="One final image per panel" />
                <Metric label="Warnings" value={String(guideState.data.guideWarnings.length)} />
                <Metric label="Rendered assets" value={String(guideState.data.attachmentSummary.attachedRenderedAssetCount)} />
              </div>
            </Card>
            <Card>
              <CardTitle>Approval</CardTitle>
              <CardDescription>Approve only after the guide, references, medical links, and lettering separation look right.</CardDescription>
              <Textarea className="mt-4 min-h-24" value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Optional review note" />
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={() => submitDecision('approved')}>Approve guide</Button>
                <Button variant="secondary" onClick={() => submitDecision('changes-requested')}>Request changes</Button>
                <Button variant="secondary" onClick={() => submitDecision('rejected')}>Reject</Button>
              </div>
            </Card>
          </div>
          <Card>
            <CardTitle>Character and reference locks</CardTitle>
            <CardDescription>Cyto and Pip should stay visually and personally consistent across every panel.</CardDescription>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {visualItems.slice(0, 8).map((item) => (
                <div key={item.id} className="rounded-2xl border border-black/10 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-shell-950">{item.canonicalName}</p>
                      <p className="text-xs text-slate-500">{titleFromSlug(item.itemType)} · {item.usagePanelIds.length} panels</p>
                    </div>
                    <StatusPill label={item.approvalStatus} />
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-600">{[...item.textLocks, ...(item.personalityLocks ?? []), ...(item.continuityLocks ?? [])].slice(0, 6).join(' · ')}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <CardTitle>Panel readiness</CardTitle>
            <CardDescription>Each panel needs references, claim links, and separate lettering before rendering.</CardDescription>
            <div className="mt-4 grid gap-3">
              {panels.map((panel) => {
                const panelRecord = panel as Record<string, unknown>;
                const panelId = String(panelRecord.panelId ?? 'panel');
                const references = Array.isArray(panelRecord.visualReferenceItemIds) ? panelRecord.visualReferenceItemIds : [];
                const claims = Array.isArray(panelRecord.claimReferences) ? panelRecord.claimReferences : [];
                const lettering = Array.isArray(panelRecord.letteringEntries) ? panelRecord.letteringEntries : [];

                return (
                  <div key={panelId} className="grid gap-3 rounded-2xl border border-black/10 bg-white p-4 md:grid-cols-[1fr_auto] md:items-center">
                    <div>
                      <p className="font-semibold text-shell-950">{panelId}</p>
                      <p className="text-sm text-slate-600">{String(panelRecord.storyFunction ?? 'Story purpose pending')}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge>{references.length} refs</Badge>
                      <Badge>{claims.length} claims</Badge>
                      <Badge>{lettering.length} lettering</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void regenerateRenderingGuide(runId).then(() => {
              setNotice('Guide regenerated. Approval is required again.');
              refreshRun();
            })}>Regenerate guide</Button>
            <Button variant="secondary" onClick={() => void regenerateVisualReferencePack(runId).then(() => {
              setNotice('Visual references regenerated. Approval is required again.');
              refreshRun();
            })}>Regenerate references</Button>
          </div>
        </>
      ) : (
        <Alert tone="info">Rendering guide is loading or has not been generated yet.</Alert>
      )}
    </SectionStack>
  );
}

export function CreatorRenderPanelsPage() {
  const { runId, refreshRun } = useRunPageContext();
  const refreshSignal = useRefreshSignal(runId);
  const reviewState = useReviewRunState();
  const guideState = useRemoteData(() => fetchRenderingGuideView(runId), [runId, refreshSignal]);
  const renderJobs = reviewState.data?.renderJobs ?? [];
  const latestJob = renderJobs.at(-1);
  const isApproved = guideState.data?.gateStatus === 'approved';

  return (
    <SectionStack>
      <PageHeader
        eyebrow="Render panels"
        title="Create the final panel art"
        description="Rendering stays blocked until the latest guide and visual reference pack are approved."
      />
      <PageCoach
        title="Create one final image for every approved panel."
        checks={[
          'The guide gate says approved.',
          'The latest job completed successfully.',
          'Every required panel is represented in the completed panel set.',
        ]}
        nextStep="Queue panel rendering once the guide is approved, then review the job history before moving to final checks and export."
        blockedHint="If the button is disabled, return to Guide Review and approve or regenerate the visual plan."
      />
      {!isApproved ? <Alert tone="warning">{guideState.data?.renderDisabledReason ?? 'Guide approval is required before rendering.'}</Alert> : null}
      <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <Card>
          <CardTitle>Render status</CardTitle>
          <CardDescription>{latestJob ? `Latest job ${latestJob.id}` : 'No render job has been created yet.'}</CardDescription>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Metric label="Guide gate" value={guideState.data?.gateStatus ? titleFromSlug(guideState.data.gateStatus) : 'Loading'} />
            <Metric label="Render jobs" value={String(renderJobs.length)} />
            <Metric label="Panel set" value={reviewState.data && renderManifestPresent(reviewState.data) ? 'Complete' : 'Missing'} />
          </div>
          <div className="mt-4">
            <Button
              disabled={!isApproved}
              onClick={() => void createRenderJob(runId).then(() => refreshRun())}
            >
              Queue panel rendering
            </Button>
          </div>
        </Card>
        <Card>
          <CardTitle>Panel completion</CardTitle>
          <CardDescription>Use this as a simple checklist before export.</CardDescription>
          <div className="mt-4 grid gap-3">
            {(guideState.data?.renderingGuide.panels ?? []).map((panel) => {
              const panelRecord = panel as Record<string, unknown>;
              const panelId = String(panelRecord.panelId ?? 'panel');

              return (
                <div key={panelId} className="flex items-center justify-between rounded-2xl border border-black/10 bg-slate-50 px-4 py-3">
                  <span className="text-sm font-semibold text-shell-950">{panelId}</span>
                  <StatusPill label={latestJob?.status === 'completed' ? 'complete' : 'waiting'} />
                </div>
              );
            })}
          </div>
        </Card>
      </div>
      <Card>
        <CardTitle>Render job history</CardTitle>
        <div className="mt-4 grid gap-3">
          {renderJobs.length === 0 ? <Alert tone="info">No render attempts yet.</Alert> : renderJobs.map((renderJob: RenderJob) => (
            <div key={renderJob.id} className="rounded-2xl border border-black/10 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-shell-950">{renderJob.id}</p>
                  <p className="text-xs text-slate-500">{renderJob.provider} · {renderJob.model} · {formatDateTime(renderJob.updatedAt)}</p>
                </div>
                <StatusPill label={renderJob.status} />
              </div>
              {renderJob.lastError ? <Alert tone="warning" className="mt-3">{renderJob.lastError}</Alert> : null}
            </div>
          ))}
        </div>
      </Card>
    </SectionStack>
  );
}

export function CreatorExportPage() {
  const { runId, refreshRun } = useRunPageContext();
  const reviewState = useReviewRunState();
  const refreshSignal = useRefreshSignal(runId);
  const opsState = useRemoteData(() => fetchLocalOpsStatus(), [refreshSignal]);
  const [notice, setNotice] = useState<string | null>(null);
  const view = reviewState.data;
  const releaseId = view ? latestReleaseId(view) : undefined;
  const evalRows = view?.evaluationSummary.familyStatuses ?? [];
  const exportDisabledReason = view && !renderManifestPresent(view)
    ? 'Export requires a complete rendered panel set from the approved guide/reference pair.'
    : view?.evaluationSummary.latestEvalStatus !== 'passed'
    ? 'Export requires fresh passing safety checks.'
    : view?.creatorWorkflow.blockers[0]?.detail;

  return (
    <SectionStack>
      <PageHeader
        eyebrow="Export"
        title="Package the finished local files"
        description="Export requires approved clinical and visual work, rendered panels, fresh passing safety checks, and local integrity proof."
      />
      <PageCoach
        title="Confirm the finished run is safe to hand off."
        checks={[
          'Rendered panels are complete for the approved guide/reference pair.',
          'Safety checks are fresh and passing.',
          'The latest local package can be mirrored and verified.',
        ]}
        nextStep="Run safety checks, export the local package, then mirror and verify it for delivery."
        blockedHint="If export is disabled, the warning below names the one missing requirement to fix first."
      />
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {exportDisabledReason ? <Alert tone="warning">{exportDisabledReason}</Alert> : null}
      <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <Card>
          <CardTitle>Release readiness</CardTitle>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Metric label="Panel set" value={view && renderManifestPresent(view) ? 'Complete' : 'Missing'} />
            <Metric label="Safety checks" value={view?.evaluationSummary.latestEvalStatus ?? 'missing'} />
            <Metric label="Exports" value={String(view?.exportHistory.entries.length ?? 0)} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void runEvaluations(runId).then(() => {
              setNotice('Safety checks completed.');
              refreshRun();
            })}>
              Run safety checks
            </Button>
            <Button disabled={Boolean(exportDisabledReason)} onClick={() => void exportBundle(runId, {}).then(() => {
              setNotice('Local package exported.');
              refreshRun();
            })}>
              Export local package
            </Button>
          </div>
        </Card>
        <Card>
          <CardTitle>Local delivery proof</CardTitle>
          <CardDescription>Mirror and verify the latest release bundle without network dependencies.</CardDescription>
          <div className="mt-4 grid gap-3">
            <Metric label="Latest release" value={releaseId ?? 'No release yet'} />
            <Metric label="Restore smoke" value={opsState.data?.latestRestoreSmoke?.status ?? 'not-run'} />
            <Metric label="Mirror verification" value={opsState.data?.latestDeliveryVerification?.status ?? 'not-run'} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={!releaseId}
              onClick={() => releaseId && void mirrorReleaseBundleLocal(releaseId).then(() => setNotice('Release bundle mirrored locally.'))}
            >
              Mirror locally
            </Button>
            <Button
              variant="secondary"
              disabled={!releaseId}
              onClick={() => releaseId && void verifyReleaseBundleLocalMirror(releaseId).then(() => setNotice('Local mirror verification completed.'))}
            >
              Verify mirror
            </Button>
          </div>
        </Card>
      </div>
      <Card>
        <CardTitle>Safety checks</CardTitle>
        <CardDescription>Every applicable check must pass before the local package can be exported.</CardDescription>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {evalRows.length === 0 ? <Alert tone="info">No safety check has been recorded yet.</Alert> : evalRows.map((result: EvaluationFamilyResult) => (
            <div key={result.family} className="rounded-2xl border border-black/10 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-shell-950">{titleFromSlug(result.family)}</p>
                <StatusPill label={result.status} />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {typeof result.score === 'number' ? `Score ${Math.round(result.score * 100)}%. ` : ''}
                {result.releaseGate ?? 'Release gate'}
              </p>
              {result.blockingIssues?.length ? <p className="mt-2 text-xs text-red-700">{result.blockingIssues.join(' · ')}</p> : null}
            </div>
          ))}
        </div>
      </Card>
    </SectionStack>
  );
}

export function CreatorAdvancedDetailsPage() {
  const reviewState = useReviewRunState();
  const workflow = workflowFrom(reviewState.data);

  return (
    <SectionStack>
      <PageHeader
        eyebrow="Advanced"
        title="Technical details"
        description="The original detailed pages are still here, but they are no longer the default path."
      />
      {workflow ? <AdvancedDetails workflow={workflow} defaultOpen /> : <Alert tone="info">Loading advanced links.</Alert>}
    </SectionStack>
  );
}

export function GlobalSourcesPage() {
  const refreshSignal = useRefreshSignal();
  const sourcesState = useRemoteData(() => fetchSourceOps({}), [refreshSignal]);

  const summary = sourcesState.data?.summary;
  const sources = useMemo(() => sourcesState.data?.sourceRecords ?? [], [sourcesState.data]);

  return (
    <SectionStack>
      <PageHeader
        eyebrow="Sources"
        title="Source operations"
        description="Local owner, freshness, suspension, and refresh-work overview across governed and provisional sources."
      />
      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Sources" value={String(summary?.visibleSourceCount ?? sources.length)} />
        <Metric label="Stale" value={String(summary?.staleSourceCount ?? 0)} />
        <Metric label="Ownerless" value={String(summary?.ownerlessSourceCount ?? 0)} />
        <Metric label="Open refresh" value={String(summary?.openRefreshTaskCount ?? 0)} />
      </div>
      <Card>
        <CardTitle>Source list</CardTitle>
        <CardDescription>Open a run’s clinical review for source-specific actions.</CardDescription>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sources.length === 0 ? <Alert tone="info">No source records are visible yet. Create a disease run to populate source operations.</Alert> : sources.slice(0, 18).map((source) => (
            <div key={String(source.id)} className="rounded-2xl border border-black/10 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-shell-950">{String(source.sourceLabel ?? source.id)}</p>
              <p className="mt-1 text-xs text-slate-500">{String(source.canonicalDiseaseName ?? 'Disease pending')}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusPill label={String(source.approvalStatus ?? 'pending')} />
                <StatusPill label={String(source.freshnessState ?? source.freshnessStatus ?? 'unknown')} />
              </div>
              <p className="mt-3 text-xs text-slate-500">Owner: {String(source.primaryOwnerRole ?? 'ownerless')}</p>
            </div>
          ))}
        </div>
      </Card>
    </SectionStack>
  );
}
