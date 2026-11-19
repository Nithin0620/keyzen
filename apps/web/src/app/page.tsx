import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { ShieldCheck, Sparkles, ArrowRight } from 'lucide-react';

export default function Home(): React.ReactNode {
  return (
    <main className="relative mx-auto flex min-h-screen max-w-4xl flex-col justify-center gap-8 px-6 py-16">
      {/* Background ambient gradient */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#160c40] via-navy to-[#0b0626]" />

      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-tr from-peri to-purple-400 shadow-peri-glow">
            <ShieldCheck className="size-5 text-white" />
          </div>
          <div>
            <span className="font-sans text-xl font-semibold tracking-tight text-ink">Aegis</span>
            <span className="ml-2 font-mono text-xs text-ink-3">Supply-Side Secret Studio®</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="live">LIVE ENGINE</Badge>
          <ThemeToggle />
        </div>
      </header>

      {/* Main glass card previewing the design system */}
      <Card className="border-line/40">
        <CardHeader>
          <div className="flex items-center justify-between">
            <Badge variant="outline">Phase 13 Foundation</Badge>
            <span className="font-mono text-xs text-ink-3">API: Verified Safe</span>
          </div>
          <CardTitle className="mt-2 text-3xl font-light tracking-tight text-ink">
            Programmatic Secrets & <span className="font-serif italic text-peri-2">Cryptographic</span> Studio
          </CardTitle>
          <CardDescription className="text-base text-ink-2">
            Reusable Radix primitives, glassmorphic design tokens, and credentialed API foundation aligned with the Aegis visual architecture.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-line/30 bg-black/20 p-4 backdrop-blur-sm">
              <span className="font-mono text-xs text-ink-3">ORCHESTRATION</span>
              <p className="mt-1 text-2xl font-light text-ink">100%</p>
              <p className="mt-1 text-xs text-ink-2">Zero secrets in URLs or browser storage</p>
            </div>
            <div className="rounded-lg border border-line/30 bg-black/20 p-4 backdrop-blur-sm">
              <span className="font-mono text-xs text-ink-3">LATENCY</span>
              <p className="mt-1 text-2xl font-light text-ink">&lt; 12ms</p>
              <p className="mt-1 text-xs text-ink-2">Single-flight refresh & credentialed client</p>
            </div>
            <div className="rounded-lg border border-line/30 bg-black/20 p-4 backdrop-blur-sm">
              <span className="font-mono text-xs text-ink-3">PRIMITIVES</span>
              <p className="mt-1 text-2xl font-light text-ink">25+</p>
              <p className="mt-1 text-xs text-ink-2">Accessible Radix UI design system</p>
            </div>
          </div>

          <div className="rounded-lg border border-line/30 bg-black/30 p-4">
            <span className="font-mono text-xs text-peri-2">payload_stream.json</span>
            <pre className="mt-2 font-mono text-xs leading-relaxed text-ink-2">
              <code>{`{\n  "tenant": "aegis.prod.primary",\n  "envelope": "kms:aes-gcm-256",\n  "status": "active_sealed",\n  "token_leak_prevented": true\n}`}</code>
            </pre>
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap items-center justify-between gap-4 border-t border-line/20 pt-6">
          <div className="flex gap-2">
            <Button variant="default">
              <Sparkles className="size-4" />
              Primary Action
            </Button>
            <Button variant="ghost">Secondary</Button>
          </div>
          <Button variant="link" className="gap-1.5 text-peri-2">
            Review Gate Documentation <ArrowRight className="size-4" />
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
