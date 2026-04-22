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
      <pre className="mt-4 overflow-x-auto rounded-2xl bg-shell-950 p-4 text-xs text-slate-100">
        {toPrettyJson(value)}
      </pre>
    </Card>
  );
}
