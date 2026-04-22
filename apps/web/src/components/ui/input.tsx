import type { InputHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-shell-950 outline-none transition focus:border-accent-500 focus:ring-2 focus:ring-accent-100',
        className,
      )}
      {...props}
    />
  );
}
