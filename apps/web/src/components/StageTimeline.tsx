import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { StatusPill } from '@/components/StatusPill';
import type { WorkflowStage } from '@/lib/types';

export function StageTimeline({ stages }: { stages: WorkflowStage[] }) {
  return (
    <Card>
      <CardTitle>Stage timeline</CardTitle>
      <CardDescription>Workflow progression from intake through export.</CardDescription>
      <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
        {stages.map((stage) => (
          <div key={stage.name} className="rounded-2xl border border-black/10 bg-slate-50 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-medium text-shell-950">{stage.name}</h3>
              <StatusPill label={stage.status} />
            </div>
            {stage.notes ? <p className="text-sm text-slate-600">{stage.notes}</p> : <p className="text-sm text-slate-400">No stage notes recorded.</p>}
          </div>
        ))}
      </div>
    </Card>
  );
}
