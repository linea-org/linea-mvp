import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Schedules' };

export default function SchedulesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
