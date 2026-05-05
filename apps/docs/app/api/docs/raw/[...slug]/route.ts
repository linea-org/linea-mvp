import fs from 'node:fs';
import path from 'node:path';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;

  // Roadmap is team-internal: never expose raw source
  if (slug[0] === 'roadmap') {
    return new Response('Not found', { status: 404 });
  }

  const contentDir = path.join(process.cwd(), 'content', 'docs');
  let content = '';

  try {
    content = fs.readFileSync(path.join(contentDir, ...slug) + '.mdx', 'utf-8');
  } catch {
    try {
      content = fs.readFileSync(path.join(contentDir, ...slug, 'index.mdx'), 'utf-8');
    } catch {
      return new Response('Not found', { status: 404 });
    }
  }

  // Strip YAML frontmatter before returning
  const markdown = content.replace(/^---[\s\S]*?---\n?/, '').trim();

  return new Response(markdown, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
