import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://docs.linea.xyz';
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/docs/roadmap', '/api/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
