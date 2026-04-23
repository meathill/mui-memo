import { NO_INDEX_METADATA } from '@/lib/site';

export const metadata = NO_INDEX_METADATA;

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
