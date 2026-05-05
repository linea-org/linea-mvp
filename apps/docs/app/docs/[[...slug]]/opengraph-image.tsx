import { ImageResponse } from 'next/og';
import { source } from '@/lib/source';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const runtime = 'nodejs';

export async function generateImageMetadata(props: {
  params: Promise<{ slug?: string[] }>;
}): Promise<{ alt: string }[]> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  const title = page?.data.title ?? 'Linea Docs';
  return [{ alt: title }];
}

export default async function Image(props: { params: Promise<{ slug?: string[] }> }) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  const title = page?.data.title ?? 'Linea Docs';
  const rawDesc = page?.data.description ?? '';
  const subtitle =
    rawDesc.length > 200 ? `${rawDesc.slice(0, 197).trimEnd()}…` : rawDesc;
  const titleSize = title.length > 48 ? 44 : title.length > 36 ? 52 : 58;

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
            fontSize: titleSize,
            fontWeight: 700,
            letterSpacing: '-0.03em',
            lineHeight: 1.15,
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div
            style={{
              marginTop: 22,
              fontSize: 26,
              opacity: 0.88,
              lineHeight: 1.4,
              maxWidth: 960,
            }}
          >
            {subtitle}
          </div>
        ) : null}
        <div style={{ marginTop: 40, fontSize: 20, opacity: 0.55 }}>Linea Docs</div>
      </div>
    ),
    { ...size },
  );
}
