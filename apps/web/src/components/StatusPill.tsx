import { Badge } from '@/components/ui/badge';
import { cn, titleFromSlug } from '@/lib/utils';

const statusClasses: Record<string, string> = {
  approved: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  exported: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  generated: 'border-accent-100 bg-accent-50 text-accent-700',
  pending: 'border-sand-300 bg-sand-100 text-slate-700',
  review: 'border-amber-200 bg-amber-50 text-amber-800',
  rejected: 'border-red-200 bg-red-50 text-red-800',
  failed: 'border-red-200 bg-red-50 text-red-800',
  passed: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  stale: 'border-amber-200 bg-amber-50 text-amber-800',
  missing: 'border-sand-300 bg-sand-100 text-slate-700',
  blocked: 'border-red-200 bg-red-50 text-red-800',
  complete: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  current: 'border-accent-100 bg-accent-50 text-accent-700',
  waiting: 'border-sand-300 bg-sand-100 text-slate-700',
};

export function StatusPill({ label, className }: { label: string; className?: string }) {
  const normalized = label.toLowerCase();

  return (
    <Badge className={cn(statusClasses[normalized] ?? 'border-black/10 bg-black/5 text-slate-700', className)}>
      {titleFromSlug(label)}
    </Badge>
  );
}
