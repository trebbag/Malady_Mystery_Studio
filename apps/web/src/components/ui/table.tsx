import type { HTMLAttributes, PropsWithChildren, TableHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

export function Table({ children, className, ...props }: PropsWithChildren<TableHTMLAttributes<HTMLTableElement>>) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('min-w-full border-collapse text-left text-sm', className)} {...props}>
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className, ...props }: PropsWithChildren<HTMLAttributes<HTMLTableCellElement>>) {
  return (
    <th className={cn('border-b border-black/10 px-3 py-2 font-medium text-slate-500', className)} {...props}>
      {children}
    </th>
  );
}

export function Td({ children, className, ...props }: PropsWithChildren<HTMLAttributes<HTMLTableCellElement>>) {
  return (
    <td className={cn('border-b border-black/5 px-3 py-3 align-top', className)} {...props}>
      {children}
    </td>
  );
}
