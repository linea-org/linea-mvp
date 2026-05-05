import { source } from '@/lib/source';
import {
  DocsPage,
  DocsBody,
  DocsTitle,
  DocsDescription,
} from 'fumadocs-ui/page';
import { notFound } from 'next/navigation';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { Metadata } from 'next';
import { PageActions } from '@/components/page-actions';
import { Mermaid } from '@/components/mermaid';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://docs.linea.xyz';

export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;
  const slug = params.slug ?? [];

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <DocsTitle>{page.data.title}</DocsTitle>
          {page.data.description && (
            <DocsDescription>{page.data.description}</DocsDescription>
          )}
        </div>
        <div className="shrink-0 self-start">
          <PageActions slug={slug} title={page.data.title} />
        </div>
      </div>
      <DocsBody>
        <MDX components={{ ...defaultMdxComponents, Mermaid }} />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams().filter(({ slug }) => slug?.[0] !== 'roadmap');
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const pageUrl = `${BASE_URL}${page.url}`;

  return {
    title: page.data.title,
    description: page.data.description,
    alternates: { canonical: pageUrl },
    openGraph: {
      title: page.data.title,
      description: page.data.description,
      url: pageUrl,
      siteName: 'Linea Docs',
      type: 'article',
    },
    twitter: {
      card: 'summary',
      title: page.data.title,
      description: page.data.description,
    },
  };
}
