import { NextRequest, NextResponse } from 'next/server';

const API_BASE = `${process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'}/v1`;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; kbId: string }> },
) {
  const { workspaceId, kbId } = await params;

  if (!UUID_RE.test(workspaceId) || !UUID_RE.test(kbId)) {
    return NextResponse.json({ error: 'Invalid workspace or knowledge base ID' }, { status: 400 });
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { url?: string };
  const url = body.url?.trim();
  if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 });

  // Fetch the page
  let html: string;
  try {
    const pageRes = await fetch(url, {
      headers: { 'User-Agent': 'LineaBot/1.0 (knowledge ingestion)' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!pageRes.ok) throw new Error(`HTTP ${pageRes.status}`);
    html = await pageRes.text();
  } catch (err) {
    // Fall back to storing a reference entry
    html = '';
  }

  // Strip HTML tags and collapse whitespace
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 50_000); // cap at 50k chars

  const content = text || `[Website] ${url}`;

  // Save via backend
  const backendRes = await fetch(
    `${API_BASE}/workspaces/${workspaceId}/knowledge-bases/${kbId}/entries`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({ content, metadata: { source: 'website', url } }),
    },
  );

  if (!backendRes.ok) {
    const err = await backendRes.text();
    return NextResponse.json({ error: err }, { status: backendRes.status });
  }

  const entry = await backendRes.json();
  return NextResponse.json(entry);
}
