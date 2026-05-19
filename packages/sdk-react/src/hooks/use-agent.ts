'use client';

import { useCallback, useRef, useState } from 'react';
import { useLineaContext } from '../context';

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

export interface UseAgentOptions {
  /** Workspace ID from your Linea settings */
  workspaceId: string;
  /** Pod ID to provide workflow context to the agent (optional) */
  podId?: string;
  /** Model override (defaults to server-side default) */
  model?: string;
}

export interface UseAgentReturn {
  messages: AgentMessage[];
  streaming: boolean;
  error: string | null;
  /** Send a user message and stream the response */
  send: (text: string) => Promise<void>;
  /** Abort the current streaming response */
  stop: () => void;
  /** Clear all messages */
  clear: () => void;
}

interface SSEDelta {
  type: string;
  delta?: string;
}

export function useAgent(options: UseAgentOptions): UseAgentReturn {
  const { apiKey, baseUrl } = useLineaContext();
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || streaming) return;
      setError(null);

      const userMsg: AgentMessage = { id: `u-${Date.now()}`, role: 'user', content: text };
      const assistantId = `a-${Date.now()}`;
      const assistantMsg: AgentMessage = { id: assistantId, role: 'assistant', content: '', streaming: true };

      let currentMessages: AgentMessage[] = [];
      setMessages((prev) => {
        currentMessages = prev;
        return [...prev, userMsg, assistantMsg];
      });
      setStreaming(true);
      abortRef.current = new AbortController();

      try {
        const history = [...currentMessages, userMsg].map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const res = await fetch(`${baseUrl}/workspaces/${options.workspaceId}/agent/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            messages: history,
            context: options.podId ? { podId: options.podId } : undefined,
            model: options.model,
          }),
          signal: abortRef.current.signal,
        });

        if (!res.ok || !res.body) throw new Error(`Chat failed: ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const evt = JSON.parse(line.slice(6)) as SSEDelta;
              if (evt.type === 'text_delta' && evt.delta) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: m.content + (evt.delta ?? '') } : m,
                  ),
                );
              }
            } catch { /* ignore malformed SSE frames */ }
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          const msg = err instanceof Error ? err.message : 'Something went wrong';
          setError(msg);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId && !m.content
                ? { ...m, content: 'An error occurred. Please try again.', streaming: false }
                : m,
            ),
          );
        }
      } finally {
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m)));
        setStreaming(false);
      }
    },
    [apiKey, baseUrl, options, streaming],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clear = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, streaming, error, send, stop, clear };
}
