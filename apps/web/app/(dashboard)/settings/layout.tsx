'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Settings01Icon,
  UserMultiple02Icon,
  Key01Icon,
  SquareLock01Icon,
  AiBrain01Icon,
  GlobalIcon,
  ComputerCloudIcon,
  Invoice03Icon,
} from '@hugeicons/core-free-icons';

const BILLING_ENABLED = process.env['NEXT_PUBLIC_BILLING_ENABLED'] === 'true';

const NAV_SECTIONS = [
  {
    label: 'Workspace',
    items: [
      { href: '/settings/general',    label: 'General',     icon: Settings01Icon     },
      { href: '/settings/members',    label: 'Members',     icon: UserMultiple02Icon },
      ...(BILLING_ENABLED ? [{ href: '/settings/billing', label: 'Billing', icon: Invoice03Icon }] : []),
    ],
  },
  {
    label: 'Security',
    items: [
      { href: '/settings/api-keys',    label: 'API Keys',    icon: Key01Icon        },
      { href: '/settings/credentials', label: 'Secrets',     icon: SquareLock01Icon },
    ],
  },
  {
    label: 'AI & Integrations',
    items: [
      { href: '/settings/model-keys',  label: 'Model Keys',  icon: AiBrain01Icon    },
      { href: '/settings/connections', label: 'Connections', icon: GlobalIcon        },
      { href: '/settings/mcp-servers', label: 'MCP Servers', icon: ComputerCloudIcon },
    ],
  },
];

function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav className="space-y-5">
      {NAV_SECTIONS.map((section) => (
        <div key={section.label}>
          <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
            {section.label}
          </p>
          <div className="space-y-px">
            {section.items.map(({ href, label, icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/');
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                    active
                      ? 'bg-muted text-foreground font-medium'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  }`}
                >
                  <HugeiconsIcon icon={icon} className="size-4 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-10">
      {/* Sticky left nav */}
      <aside className="w-44 shrink-0">
        <div className="sticky top-6">
          <p className="mb-4 text-base font-semibold">Settings</p>
          <SettingsNav />
        </div>
      </aside>

      {/* Page content */}
      <div className="min-w-0 flex-1 space-y-6 pb-16">
        {children}
      </div>
    </div>
  );
}
