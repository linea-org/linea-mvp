import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get('title') ?? 'Linea Docs';
  const description = searchParams.get('description') ?? '';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 72,
          background: 'linear-gradient(145deg, #1e1a4a 0%, #0f172a 52%, #1e293b 100%)',
          color: '#f1f5f9',
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            opacity: 0.55,
            marginBottom: 24,
          }}
        >
          Linea Docs
        </div>
        <div
          style={{
            fontSize: title.length > 40 ? 44 : 54,
            fontWeight: 700,
            letterSpacing: '-0.03em',
            lineHeight: 1.15,
            maxWidth: 900,
          }}
        >
          {title}
        </div>
        {description && (
          <div
            style={{
              marginTop: 24,
              fontSize: 24,
              opacity: 0.75,
              lineHeight: 1.4,
              maxWidth: 860,
            }}
          >
            {description.length > 120 ? `${description.slice(0, 120)}…` : description}
          </div>
        )}
        <div style={{ marginTop: 'auto', paddingTop: 48, fontSize: 18, opacity: 0.4 }}>
          docs.getlinea.app
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
