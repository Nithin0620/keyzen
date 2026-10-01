import { Navbar } from '../../components/navbar';

/**
 * App shell layout — wraps all authenticated routes with the navbar.
 * Auth routes live in (auth)/ and skip this layout.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
