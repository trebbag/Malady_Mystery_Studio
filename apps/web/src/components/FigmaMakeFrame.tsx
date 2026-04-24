import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { StatusPill } from '@/components/StatusPill';
import type { DashboardRun, ReviewDashboardView, WorkflowArtifactListView, WorkflowRun } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';

const stageOperators = [
  {
    stage: 'intake',
    operator: 'Intake Scout',
    purpose: 'Receives the disease brief and creates the local project/run record.',
  },
  {
    stage: 'canonicalization',
    operator: 'Clinical Truth Warden',
    purpose: 'Normalizes the typed condition without mutating medical meaning.',
  },
  {
    stage: 'disease-packet',
    operator: 'Clinical Truth Warden',
    purpose: 'Assembles governed claims, sources, contradictions, and teaching goals.',
  },
  {
    stage: 'story-workbook',
    operator: 'Workbook Weaver',
    purpose: 'Builds the fair mystery spine, clue ladder, reveal order, and review trace.',
  },
  {
    stage: 'scene-planning',
    operator: 'Scene Architect',
    purpose: 'Turns the workbook into scene-level story beats and body-world locations.',
  },
  {
    stage: 'panel-planning',
    operator: 'Panel Composer',
    purpose: 'Breaks scenes into panel plans with claim links and continuity anchors.',
  },
  {
    stage: 'render-prep',
    operator: 'Render Forge',
    purpose: 'Separates image prompts from lettering and prepares panel render specs.',
  },
  {
    stage: 'review',
    operator: 'Reviewer Relay',
    purpose: 'Coordinates approvals, threads, eval blockers, and queue escalation.',
  },
  {
    stage: 'export',
    operator: 'Export Courier',
    purpose: 'Assembles release bundles after gates, evals, and rendering requirements pass.',
  },
] as const;

const evalOperator = {
  operator: 'Eval Engine',
  purpose: 'Scores medical accuracy, traceability, render readiness, output structure, and release governance.',
};

const artifactStageHints: Record<string, string> = {
  'canonical-disease': 'canonicalization',
  'research-brief': 'canonicalization',
  'disease-packet': 'disease-packet',
  'fact-table': 'disease-packet',
  'evidence-graph': 'disease-packet',
  'clinical-teaching-points': 'disease-packet',
  'visual-anchor-catalog': 'disease-packet',
  'story-workbook': 'story-workbook',
  'narrative-review-trace': 'story-workbook',
  'scene-card': 'scene-planning',
  'panel-plan': 'panel-planning',
  'render-prompt': 'render-prep',
  'lettering-map': 'render-prep',
  'rendering-guide': 'render-prep',
  'visual-reference-pack': 'render-prep',
  'render-guide-review-decision': 'render-prep',
  'render-job': 'render-prep',
  'rendered-asset-manifest': 'render-prep',
  'qa-report': 'review',
  'eval-run': 'review',
  'release-bundle': 'export',
};

function normalize(value: string) {
  return value.toLowerCase().replace(/_/g, '-');
}

function stageStatus(workflowRun: WorkflowRun | null, stage: string) {
  if (!workflowRun) {
    return 'ready';
  }

  return workflowRun.stages.find((candidate) => normalize(candidate.name) === stage)?.status ?? 'pending';
}

function artifactCountForStage(artifacts: WorkflowArtifactListView | null | undefined, stage: string) {
  return (
    artifacts?.artifacts.filter((artifact) => artifactStageHints[artifact.artifactType] === stage).length ?? 0
  );
}

function progressForRun(workflowRun: WorkflowRun | null) {
  if (!workflowRun || workflowRun.stages.length === 0) {
    return { complete: 0, total: stageOperators.length, percent: 0 };
  }

  const complete = workflowRun.stages.filter((stage) => ['passed', 'approved', 'completed'].includes(stage.status)).length;
  return {
    complete,
    total: workflowRun.stages.length,
    percent: Math.round((complete / workflowRun.stages.length) * 100),
  };
}

export function FigmaMakeHero({
  dashboardView,
  onOpenQueue,
}: {
  dashboardView?: ReviewDashboardView | null;
  onOpenQueue: () => void;
}) {
  const stats = dashboardView?.stats;
  const newestRun = dashboardView?.runs[0];

  return (
    <section className="figma-hero overflow-hidden rounded-[2rem] border border-cyan-200/20 bg-shell-950 text-white shadow-panel">
      <div className="figma-scanline relative grid gap-6 p-6 lg:grid-cols-[1.35fr_0.65fr] lg:p-8">
        <div className="relative z-10 space-y-6">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent-300">Malady Mystery Studio</p>
            <div className="max-w-4xl space-y-3">
              <h1 className="font-display text-4xl font-semibold leading-tight text-white lg:text-5xl">
                Comic-noir production desk for clinically governed mystery runs.
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-slate-300">
                This is the active Figma Make shell: run queue, stage operators, artifact chips, review gates, evals, and
                export state are all wired to local API data instead of demo content.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <HeroMetric label="Runs" value={stats?.visibleRunCount ?? 0} />
            <HeroMetric label="Clinical blockers" value={stats?.blockedClinicalRunCount ?? 0} tone="warning" />
            <HeroMetric label="Overdue work" value={stats?.overdueWorkItemCount ?? 0} tone="danger" />
            <HeroMetric label="Export ready" value={stats?.exportReadyCount ?? 0} tone="success" />
          </div>
        </div>

        <div className="relative z-10 rounded-[1.5rem] border border-white/10 bg-white/8 p-5 backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Command focus</p>
          {newestRun ? (
            <div className="mt-4 space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-white">{newestRun.diseaseName}</h2>
                <p className="mt-1 text-sm text-slate-300">{newestRun.projectTitle}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusPill label={newestRun.state} className="border-white/15 bg-white/10 text-white" />
                <StatusPill label={newestRun.currentStage} className="border-white/15 bg-white/10 text-white" />
                <StatusPill label={newestRun.latestEvalStatus} className="border-white/15 bg-white/10 text-white" />
              </div>
              <p className="text-xs text-slate-400">Updated {formatDateTime(newestRun.updatedAt)}</p>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <h2 className="text-xl font-semibold text-white">No local runs yet</h2>
              <p className="text-sm leading-6 text-slate-300">
                Start with any disease or condition. The empty-state still shows the intended Figma structure so the UI
                does not collapse back into a plain placeholder.
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={onOpenQueue}
            className="mt-5 w-full rounded-xl border border-accent-300/30 bg-accent-300/10 px-4 py-3 text-sm font-semibold text-accent-100 transition hover:bg-accent-300/20"
          >
            Open review queue
          </button>
        </div>
      </div>
    </section>
  );
}

function HeroMetric({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'warning' | 'danger' | 'success';
}) {
  const toneClass = {
    default: 'text-accent-100',
    warning: 'text-amber-100',
    danger: 'text-rose-100',
    success: 'text-emerald-100',
  }[tone];

  return (
    <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className={`mt-2 font-display text-3xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

export function FigmaMakeStageDeck({
  workflowRun,
  artifacts,
}: {
  workflowRun?: WorkflowRun | null;
  artifacts?: WorkflowArtifactListView | null;
}) {
  const progress = progressForRun(workflowRun ?? null);
  const currentStage = workflowRun?.currentStage ? normalize(workflowRun.currentStage) : '';

  return (
    <Card className="overflow-hidden border-cyan-950/10 bg-white/95 p-0">
      <div className="figma-panel-stripe border-b border-black/10 px-5 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Figma Make pipeline command deck</CardTitle>
            <CardDescription>
              Stage operators, gate state, and artifact chips from the Make design, backed by live workflow data.
            </CardDescription>
          </div>
          <div className="min-w-56">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              <span>Progress</span>
              <span>{progress.percent}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-accent-500" style={{ width: `${progress.percent}%` }} />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {progress.complete} of {progress.total} stages passed
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 p-5 xl:grid-cols-3">
        {stageOperators.map((entry, index) => {
          const status = stageStatus(workflowRun ?? null, entry.stage);
          const artifactCount = artifactCountForStage(artifacts, entry.stage);
          const isCurrent = currentStage === entry.stage;

          return (
            <div
              key={entry.stage}
              className={[
                'relative overflow-hidden rounded-2xl border p-4 transition',
                isCurrent ? 'border-accent-500 bg-accent-50' : 'border-black/10 bg-slate-50',
              ].join(' ')}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {String(index + 1).padStart(2, '0')} / {entry.operator}
                  </p>
                  <h3 className="mt-2 font-display text-xl font-semibold text-shell-950">{entry.stage}</h3>
                </div>
                <StatusPill label={status} />
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{entry.purpose}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                  {artifactCount} artifacts
                </span>
                {isCurrent ? (
                  <span className="rounded-full border border-accent-500/20 bg-accent-500/10 px-3 py-1 text-xs font-semibold text-accent-700">
                    current gate
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
        <div className="rounded-2xl border border-dashed border-accent-500/40 bg-accent-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-700">Eval companion</p>
          <h3 className="mt-2 font-display text-xl font-semibold text-shell-950">{evalOperator.operator}</h3>
          <p className="mt-3 text-sm leading-6 text-slate-600">{evalOperator.purpose}</p>
          <div className="mt-4">
            <StatusPill label={workflowRun?.latestEvalStatus ?? 'missing'} />
          </div>
        </div>
      </div>
    </Card>
  );
}

export function FigmaMakeEmptyQueue({ runs }: { runs: DashboardRun[] }) {
  if (runs.length > 0) {
    return null;
  }

  return (
    <Card className="border-dashed border-accent-500/40 bg-accent-50">
      <CardTitle>No runs in the local queue yet</CardTitle>
      <CardDescription>
        The Figma Make frontend is active. Create a disease run to populate the sidebar, stage deck, review pages,
        evidence views, panel/render surfaces, evals, and release bundle pages with live local data.
      </CardDescription>
      <div className="mt-4">
        <FigmaMakeStageDeck workflowRun={null} artifacts={null} />
      </div>
    </Card>
  );
}
