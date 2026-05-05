/** Site URL with no trailing slash (used for metadata, canonical, sitemap). */
export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://docs.getlinea.app';
  return raw.replace(/\/$/, '');
}

export const SITE_NAME = 'Linea Docs';

export const DEFAULT_DESCRIPTION =
  'Documentation for Linea: the AI workflow automation platform. Build and orchestrate AI agents with memory, MCP tool integrations, schedules, webhooks, and multi-step execution.';

export function websiteJsonLd() {
  const url = getSiteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url,
    description: DEFAULT_DESCRIPTION,
    inLanguage: 'en',
    publisher: {
      '@type': 'Organization',
      name: 'Linea',
      url,
    },
  };
}
