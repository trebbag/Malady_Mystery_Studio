import { Badge } from '@/components/ui/badge';
import { cn, titleFromSlug } from '@/lib/utils';

const statusClasses: Record<string, string> = {
  approved: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  exported: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  generated: 'border-cyan-300 bg-cyan-50 text-cyan-800',
  pending: 'border-slate-300 bg-slate-100 text-slate-700',
  review: 'border-amber-300 bg-amber-50 text-amber-800',
  rejected: 'border-red-300 bg-red-50 text-red-800',
  failed: 'border-red-300 bg-red-50 text-red-800',
  passed: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  stale: 'border-amber-300 bg-amber-50 text-amber-800',
  missing: 'border-slate-300 bg-slate-100 text-slate-700',
  blocked: 'border-red-300 bg-red-50 text-red-800',
};

export function StatusPill({ label, className }: { label: string; className?: string }) {
  const normalized = label.toLowerCase();

  return (
    <Badge className={cn(statusClasses[normalized] ?? 'border-black/10 bg-black/5 text-slate-700', className)}>
      {titleFromSlug(label)}
    </Badge>
  );
}
