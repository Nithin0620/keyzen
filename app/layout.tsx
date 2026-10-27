import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import { KeyRound, Shield, Terminal, BookOpen, LayoutDashboard } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Keyzen | Developer-First Secrets Manager',
  description: 'Zero-Disk Secret Injection and Envelope Encryption Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-black text-white antialiased min-h-screen flex flex-col">
        {/* Sleek Top Navigation */}
        <header className="border-b border-[#222222] bg-[#0a0a0a]/90 backdrop-blur sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/30 flex items-center justify-center text-green-400 group-hover:border-green-500/60 transition-colors">
                <KeyRound className="w-4 h-4" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-bold tracking-tight text-white text-base">Keyzen</span>
                <span className="text-[10px] font-mono uppercase bg-green-500/10 text-green-400 border border-green-500/20 px-1.5 py-0.5 rounded">
                  SaaS
                </span>
              </div>
            </Link>

            <nav className="flex items-center gap-5 text-sm">
              <Link
                href="/cli"
                className="text-gray-400 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-mono"
              >
                <Terminal className="w-3.5 h-3.5 text-green-400" />
                <span>CLI Docs</span>
              </Link>
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500 hover:bg-green-400 text-black font-semibold text-xs transition-colors"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Console</span>
              </Link>
            </nav>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
          {children}
        </main>

        {/* Modern Footer */}
        <footer className="border-t border-[#1a1a1a] bg-[#080808] py-8 text-xs text-gray-500 font-mono">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-green-400" />
              <span>AES-256-GCM Envelope Encryption &bull; Zero-Disk Injection</span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/cli" className="hover:text-white transition-colors">CLI Guidance</Link>
              <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
              <span>&copy; {new Date().getFullYear()} Keyzen Platform</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
