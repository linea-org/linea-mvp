'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const BILLING_ENABLED = process.env['NEXT_PUBLIC_BILLING_ENABLED'] === 'true';

const tabs = [
  { href: '/settings/general', label: 'General' },
  { href: '/settings/members', label: 'Members' },
  { href: '/settings/api-keys', label: 'API Keys' },
  { href: '/settings/credentials', label: 'Secrets' },
  { href: '/settings/model-keys', label: 'Model Keys' },
  { href: '/settings/connections', label: 'Connections' },
  ...(BILLING_ENABLED ? [{ href: '/settings/billing', label: 'Billing' }] : []),
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your workspace settings</p>
      </div>

      <div className="flex gap-1 border-b">
        {tabs.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={[
              'px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              pathname === href
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {label}
          </Link>
        ))}
      </div>

      <div>{children}</div>
    </div>
  );
}
