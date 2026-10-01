import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '../components/providers';

export const metadata: Metadata = {
  title: 'Keyzen | Developer Secrets Management Platform',
  description: 'Zero-disk, envelope-encrypted developer secrets platform with GraphQL & CLI integration',
};

/**
 * Root layout — only wraps with global styles + providers.
 * The app shell (Navbar + main container) lives in (app)/layout.tsx
 * so that the (auth) route group can render full-screen without it.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-black text-foreground antialiased selection:bg-accent/30 selection:text-white">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
