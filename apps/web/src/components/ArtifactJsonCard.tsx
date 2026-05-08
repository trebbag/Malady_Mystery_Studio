import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { toPrettyJson } from '@/lib/utils';

export function ArtifactJsonCard({
  title,
  description,
  value,
}: {
  title: string;
  description?: string;
  value: unknown;
}) {
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      {description ? <CardDescription>{description}</CardDescription> : null}
      <details className="mt-4 rounded-2xl border border-black/10 bg-slate-50">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-shell-950">
          Developer details
        </summary>
        <pre className="overflow-x-auto rounded-b-2xl bg-shell-950 p-4 text-xs text-slate-100">
          {toPrettyJson(value)}
        </pre>
      </details>
    </Card>
  );
}
