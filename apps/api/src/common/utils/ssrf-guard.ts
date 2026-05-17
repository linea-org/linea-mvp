import { lookup } from 'dns/promises';
import { ForbiddenException } from '@nestjs/common';

const PRIVATE_IP_RANGES = [
  /^127\./, // loopback
  /^10\./, // RFC 1918
  /^172\.(1[6-9]|2\d|3[01])\./, // RFC 1918
  /^192\.168\./, // RFC 1918
  /^169\.254\./, // link-local / AWS metadata
  /^100\.64\./, // CGNAT
  /^::1$/, // IPv6 loopback
  /^fc00:/i, // IPv6 unique local
  /^fe80:/i, // IPv6 link-local
  /^0\./, // this-network
];

const ALLOWED_SCHEMES = new Set(['http:', 'https:']);

export async function assertSafeUrl(rawUrl: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new ForbiddenException(`Invalid URL: ${rawUrl}`);
  }

  if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
    throw new ForbiddenException(
      `URL scheme "${parsed.protocol}" is not allowed`,
    );
  }

  // Resolve hostname to catch DNS-based SSRF (rebinding, CNAME to internal)
  let address: string;
  try {
    const result = await lookup(parsed.hostname);
    address = result.address;
  } catch {
    throw new ForbiddenException(
      `Could not resolve hostname: ${parsed.hostname}`,
    );
  }

  if (PRIVATE_IP_RANGES.some((r) => r.test(address))) {
    throw new ForbiddenException(
      `Requests to private/internal addresses are not allowed`,
    );
  }
}
