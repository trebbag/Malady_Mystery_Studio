import { useMemo, useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { SectionStack } from '@/components/StatePanel';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  attachRenderedAssets,
  createRenderJob,
  fetchRenderingGuideView,
  regenerateRenderingGuide,
  regenerateVisualReferencePack,
  submitRenderingGuideReviewDecision,
} from '@/lib/api';
import { useRefreshSignal } from '@/lib/refresh-context';
import type { RenderingGuideView, VisualReferenceItem } from '@/lib/types';
import { useRemoteData } from '@/lib/use-remote-data';
import { useRunPageContext } from '@/pages/RunLayout';

function downloadMarkdown(fileName: string, contents: string) {
  const blob = new Blob([contents], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function asString(value: unknown, fallback = 'Not provided') {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function panelId(panel: Record<string, unknown>) {
  return asString(panel.panelId, 'panel.unknown');
}

function toneForGateStatus(status: RenderingGuideView['gateStatus']) {
  if (status === 'approved') {
    return 'success' as const;
  }

  if (status === 'rejected' || status === 'stale') {
    return 'critical' as const;
  }

  return 'warning' as const;
}

function labelForGateStatus(status: RenderingGuideView['gateStatus']) {
  return status
    .split('-')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function lockList(title: string, values: string[]) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.length > 0 ? values.map((value) => (
          <Badge key={value} className="border-slate-200 bg-slate-50 text-slate-700 normal-case tracking-normal">{value}</Badge>
        )) : <span className="text-sm text-slate-500">No locks recorded.</span>}
      </div>
    </div>
  );
}

export function RenderingGuidePage() {
  const { runId, refreshRun } = useRunPageContext();
  const refreshSignal = useRefreshSignal(runId);
  const [notice, setNotice] = useState<string | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [requiredChanges, setRequiredChanges] = useState('');
  const [attachmentDraft, setAttachmentDraft] = useState({
    panelId: '',
    location: '',
    mimeType: 'image/png',
    checksum: '',
    thumbnailLocation: '',
    width: '',
    height: '',
  });
  const renderingGuideState = useRemoteData(() => fetchRenderingGuideView(runId), [runId, refreshSignal]);

  const panelRows = useMemo(
    () => renderingGuideState.data?.renderingGuide.panels ?? [],
    [renderingGuideState.data],
  );
  const visualItems = renderingGuideState.data?.visualReferencePack?.items ?? [];
  const characterItems = visualItems.filter((item) => item.itemType === 'character');
  const recurringItems = visualItems.filter((item) => ['prop', 'set-piece', 'style-frame'].includes(item.itemType));
  const isApproved = renderingGuideState.data?.gateStatus === 'approved';
  const renderDisabledReason = renderingGuideState.data?.renderDisabledReason
    || 'Rendering is disabled until the guide and visual references are approved.';

  function refetchAfterMutation(message: string) {
    setNotice(message);
    refreshRun();
  }

  function submitDecision(decision: 'approved' | 'changes-requested' | 'rejected') {
    const changes = requiredChanges
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean);

    void submitRenderingGuideReviewDecision(runId, {
      decision,
      ...(reviewComment.trim() ? { comment: reviewComment.trim() } : {}),
      ...(changes.length > 0 ? { requiredChanges: changes } : {}),
    }).then(() => {
      setReviewComment('');
      setRequiredChanges('');
      refetchAfterMutation(
        decision === 'approved'
          ? 'Rendering guide and visual reference pack approved. Panel rendering is now enabled.'
          : `Review decision saved as ${decision}. Rendering remains blocked until approval.`,
      );
    }).catch((error: unknown) => {
      setNotice(error instanceof Error ? error.message : String(error));
    });
  }

  return (
    <SectionStack>
      <PageHeader
        eyebrow="Pre-Render Review"
        title="Rendering Guide Workbench"
        description="Review the full development guide, Cyto/Pip canon, recurring visual references, panel prompts, lettering separation, and medical traceability before any panel rendering occurs."
        actions={(
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => void regenerateRenderingGuide(runId).then(() => {
                refetchAfterMutation('Rendering guide and visual reference pack regenerated. Approval is required again before rendering.');
              })}
            >
              Regenerate guide
            </Button>
            <Button
              variant="secondary"
              onClick={() => void regenerateVisualReferencePack(runId).then(() => {
                refetchAfterMutation('Visual reference pack regenerated. Approval is required again before rendering.');
              })}
            >
              Regenerate references
            </Button>
            <Button
              variant="secondary"
              disabled={!renderingGuideState.data}
              onClick={() => {
                if (!renderingGuideState.data) {
                  return;
                }

                void navigator.clipboard.writeText(renderingGuideState.data.markdown).then(() => {
                  setNotice('Rendering guide markdown copied to the clipboard.');
                });
              }}
            >
              Copy markdown
            </Button>
            <Button
              disabled={!renderingGuideState.data}
              onClick={() => {
                if (!renderingGuideState.data) {
                  return;
                }

                downloadMarkdown(`${renderingGuideState.data.renderingGuide.id}.md`, renderingGuideState.data.markdown);
              }}
            >
              Download markdown
            </Button>
          </div>
        )}
      />

      {notice ? <Alert tone={notice.toLowerCase().includes('disabled') || notice.toLowerCase().includes('failed') ? 'warning' : 'success'}>{notice}</Alert> : null}

      {renderingGuideState.data ? (
        <>
          <Alert tone={toneForGateStatus(renderingGuideState.data.gateStatus)}>
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em]">Pre-render gate</p>
                <p className="mt-1 text-lg font-semibold">{labelForGateStatus(renderingGuideState.data.gateStatus)}</p>
                {renderingGuideState.data.renderDisabledReason ? (
                  <p className="mt-1">{renderingGuideState.data.renderDisabledReason}</p>
                ) : (
                  <p className="mt-1">Guide and visual reference provenance are approved. Rendering controls are enabled.</p>
                )}
              </div>
              <Button
                disabled={!isApproved}
                onClick={() => void createRenderJob(runId).then(() => {
                  refetchAfterMutation('Approved panel rendering was queued.');
                }).catch((error: unknown) => {
                  setNotice(error instanceof Error ? error.message : String(error));
                })}
              >
                Queue panel rendering
              </Button>
            </div>
          </Alert>

          <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
            <Card className="xl:sticky xl:top-6 xl:self-start">
              <CardTitle>Review rail</CardTitle>
              <CardDescription>Use this as the guided checklist before approval.</CardDescription>
              <nav className="mt-4 grid gap-2 text-sm">
                {[
                  ['#run-brief', 'Run brief'],
                  ['#style-bible', 'Style bible'],
                  ['#characters', 'Cyto and Pip'],
                  ['#references', 'Recurring references'],
                  ['#panel-matrix', 'Panel matrix'],
                  ['#panel-details', 'Panel details'],
                  ['#markdown', 'Markdown export'],
                  ['#approval-history', 'Approval history'],
                ].map(([href, label]) => (
                  <a key={href} href={href} className="rounded-xl border border-black/10 bg-white px-3 py-2 font-medium text-shell-950 hover:bg-slate-50">
                    {label}
                  </a>
                ))}
              </nav>
            </Card>

            <div className="grid gap-6">
              <Card id="run-brief">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <CardTitle>Guide overview</CardTitle>
                    <CardDescription>Rendered panels are blocked until this guide and visual reference pack are approved.</CardDescription>
                  </div>
                  <Badge className={isApproved ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-amber-300 bg-amber-50 text-amber-800'}>
                    {labelForGateStatus(renderingGuideState.data.gateStatus)}
                  </Badge>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <Metric label="Guide id" value={renderingGuideState.data.renderingGuide.id} />
                  <Metric label="Reference pack" value={renderingGuideState.data.visualReferencePack?.id ?? 'Missing'} />
                  <Metric label="Attached assets" value={String(renderingGuideState.data.attachmentSummary.attachedRenderedAssetCount)} />
                  <Metric label="Panels" value={String(panelRows.length)} />
                </div>
              </Card>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <ReviewCard
                  title="Character consistency"
                  status={characterItems.length >= 2 ? 'Ready' : 'Needs review'}
                  detail={`${characterItems.length} character reference item(s) found.`}
                />
                <ReviewCard
                  title="Personality consistency"
                  status={characterItems.every((item) => (item.personalityLocks ?? []).length >= 3) ? 'Locked' : 'Thin locks'}
                  detail="Cyto stays calm, precise, dryly funny, protective; Pip stays earnest, loyal, curious, theatrical, and competent."
                />
                <ReviewCard
                  title="Style consistency"
                  status="Reviewer label: Pixar-like"
                  detail="Provider prompts use neutral wording: premium cinematic 3D animated felt-toy rendering with warm feature-animation lighting."
                />
                <ReviewCard
                  title="Recurring coverage"
                  status={(renderingGuideState.data.visualReferencePack?.coverageSummary.recurringItemCount ?? 0) > 0 ? 'Mapped' : 'Sparse'}
                  detail={`${renderingGuideState.data.visualReferencePack?.coverageSummary.recurringItemCount ?? 0} recurring prop, set-piece, or style item(s).`}
                />
                <ReviewCard
                  title="Lettering separation"
                  status={panelRows.every((panel) => Array.isArray(panel.letteringEntries) && panel.letteringEntries.length > 0) ? 'Separated' : 'Check overlays'}
                  detail="Visible dialogue and medical text stay in lettering artifacts, not image prompts."
                />
                <ReviewCard
                  title="Medical traceability"
                  status={panelRows.every((panel) => asStringArray(panel.claimReferences).length > 0) ? 'Linked' : 'Missing links'}
                  detail="Clinically meaningful panels must retain claim references before release."
                />
                <ReviewCard
                  title="Reference freshness"
                  status={(renderingGuideState.data.guideWarnings.length === 0 && renderingGuideState.data.gateStatus !== 'stale') ? 'Current' : 'Warnings'}
                  detail={`${renderingGuideState.data.guideWarnings.length} guide warning(s); stale approvals block rendering. `}
                />
                <ReviewCard
                  title="Render-disabled reason"
                  status={isApproved ? 'Enabled' : 'Blocked'}
                  detail={isApproved ? 'Panel rendering controls are enabled.' : renderDisabledReason}
                />
              </div>

              {renderingGuideState.data.guideWarnings.length > 0 ? (
                <Alert tone="warning">
                  <p className="font-semibold">Guide warnings</p>
                  <div className="mt-2 grid gap-1">
                    {renderingGuideState.data.guideWarnings.map((warning) => (
                      <p key={warning}>{warning}</p>
                    ))}
                  </div>
                </Alert>
              ) : null}

              <Card id="style-bible">
                <CardTitle>Style bible and global locks</CardTitle>
                <CardDescription>Neutral provider-safe wording for the desired premium animated felt-toy look.</CardDescription>
                <div className="mt-4 grid gap-4">
                  {lockList('Franchise rules', asStringArray(renderingGuideState.data.renderingGuide.franchiseRules))}
                  {lockList('Global negative constraints', asStringArray(renderingGuideState.data.renderingGuide.globalNegativeConstraints))}
                  <pre className="overflow-x-auto rounded-2xl bg-shell-950 p-4 text-xs text-slate-100">
                    {renderingGuideState.data.renderingGuide.openAiPanelExecutionPrompt}
                  </pre>
                </div>
              </Card>

              <Card id="characters">
                <CardTitle>Detective Cyto Kine and Pip locks</CardTitle>
                <CardDescription>Personality and silhouette locks must stay stable across different contexts and expressions.</CardDescription>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  {characterItems.map((item) => (
                    <ReferenceItemCard key={item.id} item={item} />
                  ))}
                </div>
              </Card>

              <Card id="references">
                <CardTitle>Recurring visual references</CardTitle>
                <CardDescription>Repeated props, style frames, and set pieces should be rendered as reusable references after approval, before final panels depend on them.</CardDescription>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  {recurringItems.map((item) => (
                    <ReferenceItemCard key={item.id} item={item} compact />
                  ))}
                </div>
              </Card>

              <Card id="panel-matrix">
                <CardTitle>Panel matrix</CardTitle>
                <CardDescription>Quick scan of panel order, characters, reference coverage, claim links, and lettering readiness.</CardDescription>
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Panel</th>
                        <th className="px-3 py-2">Scene</th>
                        <th className="px-3 py-2">References</th>
                        <th className="px-3 py-2">Claims</th>
                        <th className="px-3 py-2">Lettering</th>
                      </tr>
                    </thead>
                    <tbody>
                      {panelRows.map((panel) => {
                        const refs = asStringArray(panel.visualReferenceItemIds);
                        const claims = asStringArray(panel.claimReferences);
                        const lettering = Array.isArray(panel.letteringEntries) ? panel.letteringEntries : [];

                        return (
                          <tr key={panelId(panel)} className="border-t border-black/10">
                            <td className="px-3 py-3 font-semibold text-shell-950">{panelId(panel)}</td>
                            <td className="px-3 py-3 text-slate-600">{asString(panel.location)} · page {asString(panel.pageNumber)}</td>
                            <td className="px-3 py-3 text-slate-600">{refs.length > 0 ? refs.join(', ') : 'Missing'}</td>
                            <td className="px-3 py-3 text-slate-600">{claims.length}</td>
                            <td className="px-3 py-3 text-slate-600">{lettering.length > 0 ? `${lettering.length} overlay(s)` : 'Missing'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card id="panel-details">
                <CardTitle>Side-by-side panel review</CardTitle>
                <CardDescription>Each panel keeps story purpose, medical purpose, composition, OpenAI image prompt, and separate lettering overlay instructions visible together.</CardDescription>
                <div className="mt-4 grid gap-6">
                  {panelRows.map((panel) => (
                    <PanelReviewCard key={panelId(panel)} panel={panel} />
                  ))}
                </div>
              </Card>

              <Card>
                <CardTitle>Approval controls</CardTitle>
                <CardDescription>Approve only after the guide, reference pack, character locks, recurring coverage, panel prompts, lettering separation, and medical traceability are acceptable.</CardDescription>
                <div className="mt-4 grid gap-3">
                  <Textarea
                    value={reviewComment}
                    onChange={(event) => setReviewComment(event.target.value)}
                    placeholder="Reviewer comment for the guide decision"
                  />
                  <Textarea
                    value={requiredChanges}
                    onChange={(event) => setRequiredChanges(event.target.value)}
                    placeholder="Required changes, one per line, if requesting changes or rejecting"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => submitDecision('approved')}>Approve guide and references</Button>
                    <Button variant="secondary" onClick={() => submitDecision('changes-requested')}>Request changes</Button>
                    <Button variant="secondary" onClick={() => submitDecision('rejected')}>Reject guide</Button>
                  </div>
                </div>
              </Card>

              <Card>
                <CardTitle>Render controls</CardTitle>
                <CardDescription>Controls stay visible so the blocker is obvious, but they cannot run until the pre-render gate is approved.</CardDescription>
                {!isApproved ? <Alert tone="warning" className="mt-4">{renderDisabledReason}</Alert> : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    disabled={!isApproved}
                    onClick={() => void createRenderJob(runId).then(() => {
                      refetchAfterMutation('Approved panel rendering was queued.');
                    })}
                  >
                    Queue all panels
                  </Button>
                </div>
              </Card>

              <Card>
                <CardTitle>Optional external art attachment</CardTitle>
                <CardDescription>Attach externally rendered panel art by reference only after the guide is approved. This does not bypass provenance checks.</CardDescription>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <Input
                    value={attachmentDraft.panelId}
                    onChange={(event) => setAttachmentDraft((current) => ({ ...current, panelId: event.target.value }))}
                    placeholder="Panel id"
                    disabled={!isApproved}
                  />
                  <Input
                    value={attachmentDraft.location}
                    onChange={(event) => setAttachmentDraft((current) => ({ ...current, location: event.target.value }))}
                    placeholder="External asset location"
                    disabled={!isApproved}
                  />
                  <Input
                    value={attachmentDraft.mimeType}
                    onChange={(event) => setAttachmentDraft((current) => ({ ...current, mimeType: event.target.value }))}
                    placeholder="image/png"
                    disabled={!isApproved}
                  />
                  <Input
                    value={attachmentDraft.checksum}
                    onChange={(event) => setAttachmentDraft((current) => ({ ...current, checksum: event.target.value }))}
                    placeholder="Checksum"
                    disabled={!isApproved}
                  />
                  <Input
                    value={attachmentDraft.thumbnailLocation}
                    onChange={(event) => setAttachmentDraft((current) => ({ ...current, thumbnailLocation: event.target.value }))}
                    placeholder="Thumbnail location (optional)"
                    disabled={!isApproved}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      value={attachmentDraft.width}
                      onChange={(event) => setAttachmentDraft((current) => ({ ...current, width: event.target.value }))}
                      placeholder="Width"
                      disabled={!isApproved}
                    />
                    <Input
                      value={attachmentDraft.height}
                      onChange={(event) => setAttachmentDraft((current) => ({ ...current, height: event.target.value }))}
                      placeholder="Height"
                      disabled={!isApproved}
                    />
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    disabled={!isApproved || !attachmentDraft.panelId.trim() || !attachmentDraft.location.trim() || !attachmentDraft.checksum.trim()}
                    onClick={() => void attachRenderedAssets(runId, {
                      assets: [{
                        panelId: attachmentDraft.panelId.trim(),
                        location: attachmentDraft.location.trim(),
                        mimeType: attachmentDraft.mimeType.trim() || 'image/png',
                        checksum: attachmentDraft.checksum.trim(),
                        ...(attachmentDraft.thumbnailLocation.trim() ? { thumbnailLocation: attachmentDraft.thumbnailLocation.trim() } : {}),
                        ...(attachmentDraft.width.trim() ? { width: Number(attachmentDraft.width) } : {}),
                        ...(attachmentDraft.height.trim() ? { height: Number(attachmentDraft.height) } : {}),
                      }],
                    }).then(() => {
                      setNotice(`Attached external art for ${attachmentDraft.panelId.trim()}.`);
                      setAttachmentDraft({
                        panelId: '',
                        location: '',
                        mimeType: 'image/png',
                        checksum: '',
                        thumbnailLocation: '',
                        width: '',
                        height: '',
                      });
                      refreshRun();
                    })}
                  >
                    Attach asset
                  </Button>
                  <p className="text-xs text-slate-500">
                    Available panel ids: {panelRows.map((panel) => panelId(panel)).join(', ')}
                  </p>
                </div>
              </Card>

              <Card id="markdown">
                <CardTitle>Markdown export preview</CardTitle>
                <CardDescription>Human-readable guide generated from the same source data as the JSON artifact.</CardDescription>
                <pre className="mt-4 max-h-[70vh] overflow-auto rounded-2xl bg-shell-950 p-4 text-xs text-slate-100">
                  {renderingGuideState.data.markdown}
                </pre>
              </Card>

              <Card id="approval-history">
                <CardTitle>Approval history</CardTitle>
                {renderingGuideState.data.reviewDecision ? (
                  <div className="mt-4 grid gap-2 text-sm text-slate-700">
                    <p><strong>Decision:</strong> {renderingGuideState.data.reviewDecision.decision}</p>
                    <p><strong>Reviewer:</strong> {renderingGuideState.data.reviewDecision.reviewerId}</p>
                    <p><strong>Created:</strong> {renderingGuideState.data.reviewDecision.createdAt}</p>
                    {renderingGuideState.data.reviewDecision.comment ? <p><strong>Comment:</strong> {renderingGuideState.data.reviewDecision.comment}</p> : null}
                  </div>
                ) : (
                  <CardDescription>No rendering guide review decision has been recorded yet.</CardDescription>
                )}
              </Card>
            </div>
          </div>
        </>
      ) : null}
    </SectionStack>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 break-all text-sm font-medium text-shell-950">{value}</p>
    </div>
  );
}

function ReviewCard({ title, status, detail }: { title: string; status: string; detail: string }) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</p>
      <p className="mt-2 text-xl font-semibold text-shell-950">{status}</p>
      <p className="mt-2 text-sm text-slate-600">{detail}</p>
    </Card>
  );
}

function ReferenceItemCard({ item, compact = false }: { item: VisualReferenceItem; compact?: boolean }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-shell-950">{item.canonicalName}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{item.itemType} · {item.approvalStatus}</p>
        </div>
        <Badge className="bg-white text-slate-700">{item.usagePanelIds.length} panels</Badge>
      </div>
      {item.description ? <p className="mt-3 text-sm text-slate-600">{item.description}</p> : null}
      <div className="mt-4 grid gap-4">
        {lockList('Text locks', item.textLocks)}
        {!compact ? lockList('Personality locks', item.personalityLocks ?? []) : null}
        {lockList('Continuity locks', item.continuityLocks ?? [])}
        {!compact ? lockList('Style locks', item.styleLocks) : null}
      </div>
    </div>
  );
}

function PanelReviewCard({ panel }: { panel: Record<string, unknown> }) {
  const openAiImagePrompt = (panel.openAiImagePrompt ?? {}) as Record<string, unknown>;
  const letteringEntries = Array.isArray(panel.letteringEntries) ? panel.letteringEntries : [];

  return (
    <div className="rounded-3xl border border-black/10 bg-white p-5">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-lg font-semibold text-shell-950">{panelId(panel)}</p>
          <p className="text-sm text-slate-600">{asString(panel.storyFunction)} · {asString(panel.medicalObjective)}</p>
        </div>
        <Badge className="bg-slate-50 text-slate-700">Page {asString(panel.pageNumber)}</Badge>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="grid gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Composition</p>
            <p className="mt-2 text-sm text-slate-700">{asString(panel.composition)}</p>
          </div>
          {lockList('Continuity anchors', asStringArray(panel.continuityAnchors))}
          {lockList('Visual reference item ids', asStringArray(panel.visualReferenceItemIds))}
          {lockList('Claim references', asStringArray(panel.claimReferences))}
        </div>
        <div className="grid gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">OpenAI image prompt</p>
            <pre className="mt-2 max-h-72 overflow-auto rounded-2xl bg-shell-950 p-4 text-xs text-slate-100">
              {asString(openAiImagePrompt.prompt)}
            </pre>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Lettering overlay instructions</p>
            <div className="mt-2 grid gap-2">
              {letteringEntries.length > 0 ? letteringEntries.map((entry, index) => {
                const row = entry as Record<string, unknown>;

                return (
                  <div key={`${panelId(panel)}.${index}`} className="rounded-xl border border-black/10 bg-slate-50 p-3 text-sm text-slate-700">
                    <p className="font-medium">{asString(row.kind, 'lettering')} · {asString(row.placement, 'placement pending')}</p>
                    <p className="mt-1">{asString(row.text, 'Text stored in lettering map.')}</p>
                  </div>
                );
              }) : <p className="text-sm text-slate-500">No lettering entries recorded.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
