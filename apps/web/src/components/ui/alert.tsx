import type { HTMLAttributes, PropsWithChildren } from 'react';

import { cn } from '@/lib/utils';

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  tone?: 'info' | 'warning' | 'critical' | 'success';
}

const toneClasses = {
  info: 'border-accent-300 bg-accent-50 text-shell-950',
  warning: 'border-amber-300 bg-amber-50 text-amber-950',
  critical: 'border-red-300 bg-red-50 text-red-950',
  success: 'border-emerald-300 bg-emerald-50 text-emerald-950',
};

export function Alert({
  children,
  className,
  tone = 'info',
  ...props
}: PropsWithChildren<AlertProps>) {
  return (
    <div className={cn('rounded-2xl border px-4 py-3 text-sm', toneClasses[tone], className)} {...props}>
      {children}
    </div>
  );
}
