import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Settings' };

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your workspace settings</p>
      </div>
      {children}
    </div>
  );
}
