import { RootProvider } from 'fumadocs-ui/provider';
import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import './global.css';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://docs.linea.xyz';

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'Linea Docs',
    template: '%s — Linea Docs',
  },
  description:
    'Documentation for Linea — the AI workflow automation platform. Build and orchestrate AI agents with memory, tool integrations, and multi-step execution.',
  openGraph: {
    siteName: 'Linea Docs',
    type: 'website',
    url: BASE_URL,
  },
  twitter: {
    card: 'summary_large_image',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
