import { type NextRequest, NextResponse } from 'next/server';

const REALM = 'Linea Internal Docs';

function unauthorized() {
  return new NextResponse('Access restricted to Linea team members.', {
    status: 401,
    headers: {
      'WWW-Authenticate': `Basic realm="${REALM}"`,
      'Content-Type': 'text/plain',
    },
  });
}

export function middleware(request: NextRequest) {
  // normalize password: strip surrounding single or double quotes (from .env parsing)
  const rawPassword = process.env.DOCS_PASSWORD;
  const password = rawPassword && ((rawPassword.startsWith('"') && rawPassword.endsWith('"')) || (rawPassword.startsWith("'") && rawPassword.endsWith("'")))
    ? rawPassword.slice(1, -1)
    : rawPassword;
  const authHeader = request.headers.get('authorization');

  if (!password) {
    // No password set: block everything to prevent accidental exposure
    return new NextResponse('DOCS_PASSWORD environment variable is not configured.', {
      status: 401,
      headers: {
        'WWW-Authenticate': `Basic realm="${REALM}"`,
        'Content-Type': 'text/plain',
      },
    });
  }

  if (authHeader?.startsWith('Basic ')) {
    try {
      const decoded = atob(authHeader.slice(6));
      const idx = decoded.indexOf(':');
      const pw = idx >= 0 ? decoded.slice(idx + 1) : decoded;
      if (pw === password) return NextResponse.next();
    } catch (err) {
      // invalid base64; fall through to 401
    }
  }

  return unauthorized();
}

export const config = {
  matcher: [
    '/docs/:path*',
    '/docs',
  ],
};
