import type { ReactNode } from 'react';
import { Info, ShieldCheck, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CopyButton } from './copy-button';

export function DocsHero({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}): ReactNode {
  return (
    <header className="mb-12 border-b border-line pb-10">
      <p className="mb-4 font-mono text-xs uppercase tracking-[0.24em] text-peri-2">{eyebrow}</p>
      <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-ink sm:text-5xl">{title}</h1>
      <p className="mt-5 max-w-2xl text-base leading-8 text-ink-2 sm:text-lg">{description}</p>
      {children ? <div className="mt-7 flex flex-wrap gap-3">{children}</div> : null}
    </header>
  );
}

export function DocsSection({
  id,
  eyebrow,
  title,
  description,
  children,
}: {
  id: string;
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
}): ReactNode {
  return (
    <section id={id} className="mb-14 scroll-mt-28">
      <div className="mb-6">
        {eyebrow ? <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.22em] text-peri-2">{eyebrow}</p> : null}
        <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{title}</h2>
        {description ? <p className="mt-3 max-w-2xl leading-7 text-ink-2">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function CodeBlock({
  title,
  code,
  language = 'bash',
}: {
  title: string;
  code: string;
  language?: string;
}): ReactNode {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-navy-deep/70 shadow-glass-card">
      <div className="flex items-center justify-between gap-4 border-b border-line-subtle px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="size-2 shrink-0 rounded-full bg-peri shadow-peri-glow" />
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">{language}</span>
          <span className="truncate text-xs text-ink-2">{title}</span>
        </div>
        <CopyButton value={code} />
      </div>
      <pre className="overflow-x-auto px-4 py-4 text-[12.5px] leading-6 text-ink sm:text-sm">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function DocCallout({
  tone = 'tip',
  title,
  children,
}: {
  tone?: 'tip' | 'security' | 'warning';
  title: string;
  children: ReactNode;
}): ReactNode {
  const styles = {
    tip: { icon: Info, className: 'border-peri/30 bg-peri/[0.07]', iconClass: 'text-peri-2' },
    security: { icon: ShieldCheck, className: 'border-emerald-400/30 bg-emerald-400/[0.06]', iconClass: 'text-peri-2' },
    warning: { icon: TriangleAlert, className: 'border-amber-400/30 bg-amber-400/[0.06]', iconClass: 'text-amber-300' },
  }[tone];
  const Icon = styles.icon;

  return (
    <div className={cn('flex gap-4 rounded-2xl border p-5', styles.className)}>
      <Icon className={cn('mt-0.5 size-5 shrink-0', styles.iconClass)} />
      <div>
        <p className="font-medium text-ink">{title}</p>
        <div className="mt-1.5 text-sm leading-7 text-ink-2">{children}</div>
      </div>
    </div>
  );
}

export function DocCard({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon?: ReactNode;
  children?: ReactNode;
}): ReactNode {
  return (
    <div className="glass-surface rounded-2xl p-5 transition duration-300 hover:border-peri/30 hover:shadow-peri-glow/20">
      <div className="flex items-start gap-3">
        {icon ? <span className="mt-0.5 text-peri-2">{icon}</span> : null}
        <div>
          <h3 className="font-semibold text-ink">{title}</h3>
          <p className="mt-1.5 text-sm leading-6 text-ink-2">{description}</p>
        </div>
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

export function FieldTable({
  rows,
}: {
  rows: Array<{ name: string; type: string; defaultValue?: string; description: string }>;
}): ReactNode {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-navy-deep/50">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-line text-[11px] uppercase tracking-[0.16em] text-ink-3">
            <th className="px-4 py-3 font-medium">Field</th>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium">Default</th>
            <th className="px-4 py-3 font-medium">What it does</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-b border-line-subtle last:border-0 align-top">
              <td className="px-4 py-4 font-mono text-xs text-peri-2">{row.name}</td>
              <td className="px-4 py-4 font-mono text-xs text-ink-3">{row.type}</td>
              <td className="px-4 py-4 font-mono text-xs text-ink-3">{row.defaultValue ?? '—'}</td>
              <td className="px-4 py-4 leading-6 text-ink-2">{row.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StepCard({
  number,
  title,
  description,
  children,
}: {
  number: string;
  title: string;
  description: string;
  children?: ReactNode;
}): ReactNode {
  return (
    <div className="glass-surface rounded-2xl p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-peri/40 bg-peri/10 font-mono text-xs text-peri-2">
          {number}
        </span>
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-ink">{title}</h3>
          <p className="mt-1.5 leading-6 text-ink-2">{description}</p>
          {children ? <div className="mt-4 space-y-4">{children}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function CheckList({ items }: { items: string[] }): ReactNode {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <li key={item} className="flex gap-3 rounded-xl border border-line-subtle bg-white/[0.03] p-4 text-sm leading-6 text-ink-2">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-peri-2" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
