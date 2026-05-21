import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Execution Details' };

export default function ExecutionDetailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
