import type { TableHTMLAttributes, ThHTMLAttributes, TdHTMLAttributes, HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Table({ className, ...props }: TableHTMLAttributes<HTMLTableElement>): React.ReactNode {
  return (
    <div className="relative w-full overflow-x-auto">
      <table className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  );
}

export function TableHeader({ className, ...props }: TableHTMLAttributes<HTMLTableSectionElement>): React.ReactNode {
  return <thead className={cn('[&_tr]:border-b', className)} {...props} />;
}

export function TableBody({ className, ...props }: TableHTMLAttributes<HTMLTableSectionElement>): React.ReactNode {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />;
}

export function TableFooter({ className, ...props }: TableHTMLAttributes<HTMLTableSectionElement>): React.ReactNode {
  return <tfoot className={cn('border-t bg-muted/50 font-medium', className)} {...props} />;
}

export function TableRow({ className, ...props }: TableHTMLAttributes<HTMLTableRowElement>): React.ReactNode {
  return <tr className={cn('border-b transition-colors hover:bg-muted/40', className)} {...props} />;
}

export function TableHead({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>): React.ReactNode {
  return (
    <th
      className={cn('h-11 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground', className)}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>): React.ReactNode {
  return <td className={cn('p-4 align-middle', className)} {...props} />;
}

export function TableCaption({ className, ...props }: HTMLAttributes<HTMLTableCaptionElement>): React.ReactNode {
  return <caption className={cn('mt-4 text-sm text-muted-foreground', className)} {...props} />;
}
