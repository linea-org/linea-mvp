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
  const password = process.env.DOCS_PASSWORD;

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

  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Basic ')) {
    try {
      const decoded = atob(authHeader.slice(6));
      const pw = decoded.slice(decoded.indexOf(':') + 1);
      if (pw === password) return NextResponse.next();
    } catch {
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
