import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'AI Tasks' };

export default function TasksLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
