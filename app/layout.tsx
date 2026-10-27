import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import { KeyRound, Shield, Terminal } from 'lucide-react';

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
        <header className="border-b border-[#222222] bg-[#0a0a0a]/80 backdrop-blur sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/30 flex items-center justify-center text-green-400 group-hover:border-green-500/60 transition-colors">
                <KeyRound className="w-4 h-4" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-bold tracking-tight text-white text-base">Keyzen</span>
                <span className="text-[10px] font-mono uppercase bg-green-500/10 text-green-400 border border-green-500/20 px-1.5 py-0.5 rounded">
                  v2.0 Next
                </span>
              </div>
            </Link>

            <nav className="flex items-center gap-4 text-sm">
              <Link
                href="/dashboard"
                className="text-gray-300 hover:text-white transition-colors"
              >
                Dashboard
              </Link>
              <div className="flex items-center gap-1.5 text-xs text-gray-500 font-mono bg-[#141414] border border-[#222222] px-2.5 py-1 rounded-md">
                <Shield className="w-3.5 h-3.5 text-green-400" />
                <span>AES-256-GCM</span>
              </div>
            </nav>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
          {children}
        </main>

        {/* Simple Footer */}
        <footer className="border-t border-[#222222] py-4 text-center text-xs text-gray-600 font-mono">
          Keyzen &bull; Zero-Disk Secret Injection &bull; PostgreSQL
        </footer>
      </body>
    </html>
  );
}
