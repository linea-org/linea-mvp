import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const runtime = 'nodejs';

export default function Image() {
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
        <div style={{ fontSize: 58, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.15 }}>
          Linea Docs
        </div>
        <div style={{ marginTop: 22, fontSize: 26, opacity: 0.88, lineHeight: 1.4 }}>
          AI workflow orchestration platform
        </div>
        <div style={{ marginTop: 40, fontSize: 20, opacity: 0.55 }}>linea.dev/docs</div>
      </div>
    ),
    { ...size },
  );
}
