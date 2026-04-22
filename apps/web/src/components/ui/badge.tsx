import type { HTMLAttributes, PropsWithChildren } from 'react';

import { cn } from '@/lib/utils';

export function Badge({ children, className, ...props }: PropsWithChildren<HTMLAttributes<HTMLSpanElement>>) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-black/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em]',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
