import type { HTMLAttributes, PropsWithChildren } from 'react';

import { cn } from '@/lib/utils';

export function Card({ children, className, ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <section
      className={cn('rounded-2xl border border-black/10 bg-white/90 p-5 shadow-panel backdrop-blur', className)}
      {...props}
    >
      {children}
    </section>
  );
}

export function CardTitle({ children, className, ...props }: PropsWithChildren<HTMLAttributes<HTMLHeadingElement>>) {
  return (
    <h2 className={cn('font-display text-lg font-semibold text-shell-950', className)} {...props}>
      {children}
    </h2>
  );
}

export function CardDescription({ children, className, ...props }: PropsWithChildren<HTMLAttributes<HTMLParagraphElement>>) {
  return (
    <p className={cn('text-sm text-slate-600', className)} {...props}>
      {children}
    </p>
  );
}
