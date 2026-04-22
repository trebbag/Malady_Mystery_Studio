import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { StatusPill } from '@/components/StatusPill';
import type { WorkflowApproval, WorkflowRun } from '@/lib/types';

export function ApprovalsCard({
  workflowRun,
  onSubmit,
}: {
  workflowRun: WorkflowRun;
  onSubmit: (role: string, decision: 'approved' | 'rejected', comment: string) => Promise<void>;
}) {
  const [comments, setComments] = useState<Record<string, string>>({});
  const approvals = new Map<string, WorkflowApproval>(
    workflowRun.approvals.map((approval) => [approval.role, approval]),
  );

  return (
    <Card>
      <CardTitle>Approvals</CardTitle>
      <CardDescription>Required local review approvals and their current gate state.</CardDescription>
      <div className="mt-4 space-y-4">
        {workflowRun.requiredApprovalRoles.map((role) => {
          const approval = approvals.get(role);

          return (
            <div key={role} className="rounded-2xl border border-black/10 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-medium text-shell-950">{role}</h3>
                  <p className="text-sm text-slate-500">{approval?.reviewerId ?? 'Awaiting decision.'}</p>
                </div>
                <StatusPill label={approval?.decision ?? 'pending'} />
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto_auto]">
                <Input
                  placeholder="Optional comment"
                  value={comments[role] ?? ''}
                  onChange={(event) => {
                    setComments((current) => ({
                      ...current,
                      [role]: event.target.value,
                    }));
                  }}
                />
                <Button onClick={() => onSubmit(role, 'approved', comments[role] ?? '')}>Approve</Button>
                <Button variant="danger" onClick={() => onSubmit(role, 'rejected', comments[role] ?? '')}>
                  Reject
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
