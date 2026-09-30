import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '../components/providers';
import { Navbar } from '../components/navbar';

export const metadata: Metadata = {
  title: 'Keyzen | Developer Secrets Management Platform',
  description: 'Zero-disk, envelope-encrypted developer secrets platform with GraphQL & CLI integration',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-black text-foreground antialiased selection:bg-accent/30 selection:text-white">
        <Providers>
          <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
