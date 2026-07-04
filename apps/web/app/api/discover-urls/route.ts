import { NextRequest, NextResponse } from "next/server"

const MAX_URLS = 300
const TIMEOUT_MS = 8_000

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!res.ok) return null
    const ct = res.headers.get("content-type") ?? ""
    if (
      ct.includes("octet-stream") ||
      ct.includes("image") ||
      ct.includes("video")
    )
      return null
    return await res.text()
  } catch {
    return null
  }
}

async function parseSitemap(url: string, depth = 0): Promise<string[]> {
  if (depth > 2) return []
  const text = await fetchText(url)
  if (!text) return []

  const locs: string[] = []
  const locRe = /<loc>\s*(.*?)\s*<\/loc>/gi
  let m
  while ((m = locRe.exec(text)) !== null && locs.length < MAX_URLS) {
    locs.push(m[1]!)
  }

  if (locs.length === 0) return []

  if (
    text.includes("<sitemapindex") ||
    locs.some((l) => l.endsWith(".xml") || l.includes("sitemap"))
  ) {
    const results = await Promise.all(
      locs.slice(0, 10).map((l) => parseSitemap(l, depth + 1))
    )
    return results.flat()
  }

  return locs
}

// Extract <a href> links from an HTML page, returning same-host absolute URLs
async function scrapeLinks(
  pageUrl: string,
  host: string,
  pathPrefix: string
): Promise<string[]> {
  const text = await fetchText(pageUrl)
  if (!text) return []

  const links = new Set<string>()
  const hrefRe = /href=["']([^"'#?]+)/gi
  let match
  while ((match = hrefRe.exec(text)) !== null) {
    const raw = match[1]!.trim()
    try {
      const abs = new URL(raw, pageUrl)
      if (abs.host === host && isUnderPath(abs.href, host, pathPrefix)) {
        // Strip trailing slash for consistency except root
        const normalized =
          abs.pathname !== "/" ? abs.href.replace(/\/$/, "") : abs.href
        links.add(normalized)
      }
    } catch {
      // skip malformed hrefs
    }
  }
  return [...links]
}

function isSameHost(urlStr: string, host: string): boolean {
  try {
    return new URL(urlStr).host === host
  } catch {
    return false
  }
}

/**
 * Returns true if the URL is on the same host AND its pathname starts with
 * the given path prefix. If pathPrefix is "/" or empty, any path qualifies.
 */
function isUnderPath(
  urlStr: string,
  host: string,
  pathPrefix: string
): boolean {
  try {
    const u = new URL(urlStr)
    if (u.host !== host) return false
    if (!pathPrefix || pathPrefix === "/") return true
    // strip trailing slash from prefix for comparison
    const prefix = pathPrefix.endsWith("/")
      ? pathPrefix.slice(0, -1)
      : pathPrefix
    return u.pathname === prefix || u.pathname.startsWith(prefix + "/")
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  let urlStr: string
  try {
    const body = (await req.json()) as { url?: string }
    urlStr = (body.url ?? "").trim()
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  if (!urlStr)
    return NextResponse.json({ error: "url is required" }, { status: 400 })

  let parsed: URL
  try {
    parsed = new URL(urlStr)
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return NextResponse.json(
      { error: "Only http/https URLs are allowed" },
      { status: 400 }
    )
  }

  const origin = `${parsed.protocol}//${parsed.host}`
  const host = parsed.host
  const pathPrefix = parsed.pathname // e.g. "/docs" or "/"
  const hasPathFilter = pathPrefix !== "/" && pathPrefix !== ""

  const discovered = new Set<string>([urlStr])

  // 1. Try robots.txt → look for Sitemap: directives
  const robotsText = await fetchText(`${origin}/robots.txt`)
  const sitemapUrlsFromRobots: string[] = []
  if (robotsText) {
    for (const line of robotsText.split("\n")) {
      const match = line.match(/^sitemap:\s*(.+)/i)
      if (match) sitemapUrlsFromRobots.push(match[1]!.trim())
    }
  }

  // 2. Sitemap candidates
  const sitemapCandidates =
    sitemapUrlsFromRobots.length > 0
      ? sitemapUrlsFromRobots
      : [
          `${origin}/sitemap.xml`,
          `${origin}/sitemap_index.xml`,
          `${origin}/sitemap.xml.gz`,
        ]

  for (const sitemapUrl of sitemapCandidates.slice(0, 3)) {
    const urls = await parseSitemap(sitemapUrl)
    for (const u of urls) {
      // When user gave a specific path, filter to that subtree; otherwise accept all same-host
      if (
        hasPathFilter ? isUnderPath(u, host, pathPrefix) : isSameHost(u, host)
      ) {
        discovered.add(u)
      }
      if (discovered.size >= MAX_URLS) break
    }
    if (discovered.size >= MAX_URLS) break
  }

  // 3. If a specific path was given and sitemap gave us nothing beyond the seed URL,
  //    fall back to scraping <a href> links from the entered page itself
  if (hasPathFilter && discovered.size <= 1) {
    const scraped = await scrapeLinks(urlStr, host, pathPrefix)
    for (const u of scraped) {
      discovered.add(u)
      if (discovered.size >= MAX_URLS) break
    }
  }

  const result = [...discovered].slice(0, MAX_URLS)
  return NextResponse.json({ urls: result, total: result.length })
}
