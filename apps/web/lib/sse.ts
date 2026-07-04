/**
 * Consumes a fetch() SSE response body, unwrapping NestJS's MessageEvent
 * envelope ({ id, data }) so callers get the raw event payload.
 */
export async function consumeSseStream<T>(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onEvent: (event: T, eventId: string | undefined) => void,
): Promise<void> {
  const decoder = new TextDecoder();
  let buf = '';
  let currentId: string | undefined;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';

    for (const line of lines) {
      if (line.startsWith('id: ')) { currentId = line.slice(4).trim(); continue; }
      if (!line.startsWith('data: ')) continue;
      try {
        let parsed = JSON.parse(line.slice(6)) as Record<string, unknown>;
        // NestJS SSE serializes the full MessageEvent ({data,id}), not just .data
        if (parsed && !parsed['type'] && parsed['data'] && typeof parsed['data'] === 'object') {
          parsed = parsed['data'] as Record<string, unknown>;
        }
        onEvent(parsed as T, currentId);
      } catch {
        // ignore malformed line
      }
    }
  }
}
