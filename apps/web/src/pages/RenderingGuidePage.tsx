import { useMemo, useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { SectionStack } from '@/components/StatePanel';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { attachRenderedAssets, fetchRenderingGuideView, regenerateRenderingGuide } from '@/lib/api';
import { useRefreshSignal } from '@/lib/refresh-context';
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

export function RenderingGuidePage() {
  const { runId, refreshRun } = useRunPageContext();
  const refreshSignal = useRefreshSignal(runId);
  const [notice, setNotice] = useState<string | null>(null);
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

  return (
    <SectionStack>
      <PageHeader
        eyebrow="Rendering Guide"
        title="Rendering Guide"
        description="Secondary OpenAI Image support guide with run-level execution instructions, per-panel prompts, retry guidance, and separate lettering overlays."
        actions={(
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => void regenerateRenderingGuide(runId).then(() => refreshRun())}
            >
              Regenerate guide
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

      {notice ? <Alert tone="success">{notice}</Alert> : null}

      {renderingGuideState.data ? (
        <>
          <Card>
            <CardTitle>Guide overview</CardTitle>
            <CardDescription>Rendered panels are the primary deliverable. This guide stays available as a prompt, QA, and retry artifact.</CardDescription>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <Metric label="Guide id" value={renderingGuideState.data.renderingGuide.id} />
              <Metric label="Attachment mode" value={renderingGuideState.data.attachmentSummary.attachmentMode} />
              <Metric label="Attached assets" value={String(renderingGuideState.data.attachmentSummary.attachedRenderedAssetCount)} />
              <Metric label="Panels" value={String(panelRows.length)} />
            </div>
          </Card>

          <Card>
            <CardTitle>OpenAI panel execution brief</CardTitle>
            <CardDescription>Use this as the run-level instruction set before generating or regenerating individual panels.</CardDescription>
            <pre className="mt-4 overflow-x-auto rounded-2xl bg-shell-950 p-4 text-xs text-slate-100">
              {renderingGuideState.data.renderingGuide.openAiPanelExecutionPrompt ?? renderingGuideState.data.renderingGuide.gensparkDeckBootstrapPrompt}
            </pre>
          </Card>

          <Card>
            <div className="flex flex-col gap-2">
              <CardTitle>Optional external art attachment</CardTitle>
              <CardDescription>
                Attach externally rendered panel art back to this run by reference only. The rendered panels remain the primary delivery artifact.
              </CardDescription>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Input
                value={attachmentDraft.panelId}
                onChange={(event) => setAttachmentDraft((current) => ({ ...current, panelId: event.target.value }))}
                placeholder="Panel id"
              />
              <Input
                value={attachmentDraft.location}
                onChange={(event) => setAttachmentDraft((current) => ({ ...current, location: event.target.value }))}
                placeholder="External asset location"
              />
              <Input
                value={attachmentDraft.mimeType}
                onChange={(event) => setAttachmentDraft((current) => ({ ...current, mimeType: event.target.value }))}
                placeholder="image/png"
              />
              <Input
                value={attachmentDraft.checksum}
                onChange={(event) => setAttachmentDraft((current) => ({ ...current, checksum: event.target.value }))}
                placeholder="Checksum"
              />
              <Input
                value={attachmentDraft.thumbnailLocation}
                onChange={(event) => setAttachmentDraft((current) => ({ ...current, thumbnailLocation: event.target.value }))}
                placeholder="Thumbnail location (optional)"
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  value={attachmentDraft.width}
                  onChange={(event) => setAttachmentDraft((current) => ({ ...current, width: event.target.value }))}
                  placeholder="Width"
                />
                <Input
                  value={attachmentDraft.height}
                  onChange={(event) => setAttachmentDraft((current) => ({ ...current, height: event.target.value }))}
                  placeholder="Height"
                />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                disabled={!attachmentDraft.panelId.trim() || !attachmentDraft.location.trim() || !attachmentDraft.checksum.trim()}
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
                Available panel ids: {panelRows.map((panel) => String(panel.panelId)).join(', ')}
              </p>
            </div>
          </Card>

          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <Card>
              <CardTitle>Markdown preview</CardTitle>
              <CardDescription>Human-readable export of the full guide.</CardDescription>
              <pre className="mt-4 max-h-[70vh] overflow-auto rounded-2xl bg-shell-950 p-4 text-xs text-slate-100">
                {renderingGuideState.data.markdown}
              </pre>
            </Card>

            <div className="grid gap-6">
              {panelRows.map((panel) => (
                <Card key={String(panel.panelId)}>
                  <CardTitle>{String(panel.panelId)}</CardTitle>
                  <CardDescription>{String(panel.storyFunction)} · page {String(panel.pageNumber)}</CardDescription>
                  <div className="mt-4 space-y-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">OpenAI Image Prompt</p>
                      <pre className="mt-2 overflow-x-auto rounded-2xl bg-shell-950 p-4 text-xs text-slate-100">
                        {String(((panel.openAiImagePrompt ?? panel.nanoBananaPrompt) as Record<string, unknown>).prompt ?? '')}
                      </pre>
                    </div>
                  </div>
                </Card>
              ))}
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
      <p className="mt-2 text-sm font-medium text-shell-950">{value}</p>
    </div>
  );
}
