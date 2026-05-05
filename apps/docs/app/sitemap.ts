import type { MetadataRoute } from 'next';
import { source } from '@/lib/source';
import { getSiteUrl } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getSiteUrl();
  const docsEntries = source
    .getPages()
    .filter((page) => !page.url.includes('roadmap'))
    .map((page) => ({
      url: `${baseUrl}${page.url}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: page.url === '/docs' ? 1 : 0.85,
    }));

  return [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    ...docsEntries,
  ];
}
