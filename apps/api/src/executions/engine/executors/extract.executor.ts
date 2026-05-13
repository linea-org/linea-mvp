import type { WorkflowState } from '../variable-substitution';

export interface ExtractNodeData {
  scrapeUrl?: string;        // URL to scrape (supports {{variable}})
  batchUrls?: string;        // comma-separated URLs for batch mode
  scrapeFormats?: string[];  // 'markdown' | 'html' | 'text' (default: ['markdown'])
  mapUrl?: string;           // URL to map (discover links)
  searchQuery?: string;      // text to search (uses fetch + parse)
  outputField?: string;      // 'markdown' | 'html' | 'text' | 'full'
}

const HTTP_TIMEOUT_MS = 30_000;

export async function executeExtractNode(
  nodeData: ExtractNodeData,
  _state: WorkflowState,
  firecrawlApiKey?: string,
): Promise<unknown> {
  // If Firecrawl key provided, use Firecrawl API
  if (firecrawlApiKey) {
    return executeWithFirecrawl(nodeData, firecrawlApiKey);
  }

  // Fallback: native fetch + simple HTML→text extraction
  const url = nodeData.scrapeUrl ?? nodeData.mapUrl;
  if (!url) throw new Error('Extract node: no URL configured');

  return executeNativeFetch(url, nodeData.outputField ?? 'text');
}

async function executeWithFirecrawl(
  nodeData: ExtractNodeData,
  apiKey: string,
): Promise<unknown> {
  const baseUrl = 'https://api.firecrawl.dev/v1';
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  if (nodeData.scrapeUrl) {
    const formats = nodeData.scrapeFormats ?? ['markdown'];
    const res = await fetchWithTimeout(
      `${baseUrl}/scrape`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ url: nodeData.scrapeUrl, formats }),
      },
    );
    const json = await res.json() as { data?: Record<string, unknown>; success?: boolean };
    const data = json.data ?? {};
    return pickField(data, nodeData.outputField ?? 'markdown');
  }

  if (nodeData.mapUrl) {
    const res = await fetchWithTimeout(
      `${baseUrl}/map`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ url: nodeData.mapUrl }),
      },
    );
    const json = await res.json() as { links?: string[] };
    return { links: json.links ?? [], count: (json.links ?? []).length };
  }

  if (nodeData.batchUrls) {
    const urls = nodeData.batchUrls.split(',').map((u) => u.trim()).filter(Boolean);
    const res = await fetchWithTimeout(
      `${baseUrl}/batch/scrape`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ urls, formats: nodeData.scrapeFormats ?? ['markdown'] }),
      },
    );
    const json = await res.json() as { data?: unknown[] };
    return { results: json.data ?? [], count: (json.data ?? []).length };
  }

  throw new Error('Extract node: no URL configured');
}

async function executeNativeFetch(url: string, outputField: string): Promise<unknown> {
  const res = await fetchWithTimeout(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LineaBot/1.0)' },
  });

  const html = await res.text();
  const text = stripHtml(html);
  const title = extractTitle(html);

  const data = { url, title, html, text, markdown: text };
  return pickField(data, outputField);
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].trim() : '';
}

function pickField(data: Record<string, unknown>, field: string): unknown {
  if (field === 'full') return data;
  return data[field] ?? data['markdown'] ?? data['text'] ?? data;
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    return res;
  } finally {
    clearTimeout(timer);
  }
}
