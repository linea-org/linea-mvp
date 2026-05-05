import { ImageResponse } from 'next/og';

export const alt = 'Linea Docs: workflow automation platform';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

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
        <div style={{ fontSize: 62, fontWeight: 700, letterSpacing: '-0.03em' }}>Linea Docs</div>
        <div
          style={{
            marginTop: 20,
            fontSize: 30,
            opacity: 0.9,
            lineHeight: 1.35,
            maxWidth: 920,
          }}
        >
          AI workflow automation: agents, memory, MCP tools, and reliable multi-step execution
        </div>
      </div>
    ),
    { ...size },
  );
}
