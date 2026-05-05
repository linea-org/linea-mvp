import { type NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith('/docs/roadmap')) {
    return NextResponse.next();
  }

  const password = process.env.ROADMAP_PASSWORD;
  if (!password) {
    // No password configured: block access to prevent accidental exposure
    return new NextResponse('Roadmap access requires ROADMAP_PASSWORD to be configured.', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Linea Roadmap"',
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

  return new NextResponse('Access restricted to Linea team members.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Linea Roadmap"',
      'Content-Type': 'text/plain',
    },
  });
}

export const config = {
  matcher: ['/docs/roadmap', '/docs/roadmap/:path*'],
};
