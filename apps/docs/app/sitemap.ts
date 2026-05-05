import type { MetadataRoute } from 'next';
import { source } from '@/lib/source';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://docs.linea.xyz';
  return source
    .getPages()
    .filter((page) => !page.url.includes('roadmap'))
    .map((page) => ({
      url: `${baseUrl}${page.url}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: page.url === '/docs' ? 1.0 : 0.8,
    }));
}
