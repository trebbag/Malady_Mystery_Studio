import type { ReactNode } from 'react';

import { Alert } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function LoadingPanel({ rows = 3 }: { rows?: number }) {
  return (
    <Card className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </Card>
  );
}

export function EmptyPanel({ message }: { message: string }) {
  return <Alert tone="info">{message}</Alert>;
}

export function ErrorPanel({ message }: { message: string }) {
  return <Alert tone="critical">{message}</Alert>;
}

export function SectionStack({ children }: { children: ReactNode }) {
  return <div className="grid gap-6">{children}</div>;
}
