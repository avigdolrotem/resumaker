import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-neutral-200 bg-white">
        <div className="container mx-auto flex h-16 items-center px-4">
          <Link href="/" className="text-brand-600 text-2xl font-bold">
            Resumaker
          </Link>
        </div>
      </header>
      <main className="flex-1 bg-neutral-50">
        <div className="container mx-auto flex max-w-md flex-col px-4 py-12">{children}</div>
      </main>
    </div>
  );
}
