import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import type { LocalRuntimeView, WorkflowRun } from '@/lib/types';

export function AgentInspector({
  workflowRun,
  runtimeView,
}: {
  workflowRun: WorkflowRun;
  runtimeView?: LocalRuntimeView | null;
}) {
  return (
    <Card>
      <CardTitle>Run inspector</CardTitle>
      <CardDescription>Truthful replacement for the Figma Make agent inspector shell.</CardDescription>
      <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        <div>
          <dt className="text-slate-500">Run id</dt>
          <dd className="font-medium text-shell-950">{workflowRun.id}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Tenant</dt>
          <dd className="font-medium text-shell-950">{runtimeView?.tenantId ?? 'tenant.local'}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Actor</dt>
          <dd className="font-medium text-shell-950">{runtimeView?.actor.displayName ?? 'Local Operator'}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Artifacts</dt>
          <dd className="font-medium text-shell-950">{workflowRun.artifacts.length}</dd>
        </div>
      </dl>
    </Card>
  );
}
