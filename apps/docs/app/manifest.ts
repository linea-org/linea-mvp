import type { MetadataRoute } from 'next';
import { SITE_NAME, getSiteUrl } from '@/lib/site';

export default function manifest(): MetadataRoute.Manifest {
  const base = getSiteUrl();
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description:
      'Documentation for Linea: AI workflow automation with agents, memory, and integrations.',
    start_url: `${base}/docs`,
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#312e81',
    lang: 'en',
    icons: [
      {
        src: `${base}/favicon.ico`,
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  };
}
