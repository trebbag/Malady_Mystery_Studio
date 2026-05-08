import type { SelectHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'w-full rounded-[1.125rem] border border-sand-300 bg-white px-4 py-3 text-sm text-shell-950 outline-none transition focus:border-accent-500 focus:ring-2 focus:ring-accent-100',
        className,
      )}
      {...props}
    />
  );
}
