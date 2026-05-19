'use client';

import { useEffect, useRef, useState } from 'react';
import { useAgent } from '../hooks/use-agent';
import type { AgentMessage } from '../hooks/use-agent';

export interface LineaChatProps {
  workspaceId: string;
  podId?: string;
  model?: string;
  /** Placeholder text in the input */
  placeholder?: string;
  /** Welcome message shown when there are no messages */
  welcomeMessage?: string;
  /** Custom greeting title */
  title?: string;
  /** Called whenever a message is added */
  onMessage?: (message: AgentMessage) => void;
  className?: string;
  /** Maximum height of the message area (CSS value) */
  maxHeight?: string;
}

function TypingIndicator() {
  return (
    <div className="linea-chat__typing" aria-label="Agent is typing">
      <span className="linea-chat__dot" style={{ animationDelay: '0ms' }} />
      <span className="linea-chat__dot" style={{ animationDelay: '150ms' }} />
      <span className="linea-chat__dot" style={{ animationDelay: '300ms' }} />
    </div>
  );
}

function Message({ msg }: { msg: AgentMessage }): React.ReactElement {
  const isUser = msg.role === 'user';
  return (
    <div className={`linea-chat__message linea-chat__message--${isUser ? 'user' : 'assistant'}`}>
      {!isUser && (
        <div className="linea-chat__avatar" aria-hidden>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
      )}
      <div className="linea-chat__bubble">
        {msg.streaming && !msg.content ? (
          <TypingIndicator />
        ) : (
          <span className="linea-chat__text">{msg.content}</span>
        )}
        {msg.streaming && msg.content && (
          <span className="linea-chat__cursor" aria-hidden>▋</span>
        )}
      </div>
    </div>
  );
}

export function LineaChat({
  workspaceId,
  podId,
  model,
  placeholder = 'Message…',
  welcomeMessage,
  title = 'Linea Agent',
  onMessage,
  className,
  maxHeight = '480px',
}: LineaChatProps) {
  const { messages, streaming, error, send, stop } = useAgent({ workspaceId, podId, model });
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    const last = messages[messages.length - 1];
    if (last && !last.streaming) onMessage?.(last);
  }, [messages, onMessage]);

  function resize() {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');
    resize();
    await send(text);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  const hasMessages = messages.length > 0;

  return (
    <div className={`linea-chat${className ? ` ${className}` : ''}`}>
      {/* Header */}
      <div className="linea-chat__header">
        <div className="linea-chat__header-icon" aria-hidden>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        <span className="linea-chat__header-title">{title}</span>
        <div className="linea-chat__header-status" data-streaming={streaming} aria-label={streaming ? 'Agent is thinking' : 'Ready'} />
      </div>

      {/* Messages */}
      <div className="linea-chat__messages" style={{ maxHeight }}>
        {!hasMessages ? (
          <div className="linea-chat__empty">
            {welcomeMessage ?? 'How can I help you today?'}
          </div>
        ) : (
          messages.map((msg) => <Message key={msg.id} msg={msg} />)
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <div className="linea-chat__error" role="alert">{error}</div>
      )}

      {/* Input */}
      <div className="linea-chat__footer">
        <textarea
          ref={textareaRef}
          className="linea-chat__input"
          rows={1}
          placeholder={streaming ? 'Agent is thinking…' : placeholder}
          value={input}
          onChange={(e) => { setInput(e.target.value); resize(); }}
          onKeyDown={handleKeyDown}
          disabled={streaming}
          aria-label="Message input"
        />
        {streaming ? (
          <button className="linea-chat__stop" onClick={stop} aria-label="Stop" title="Stop">
            <span className="linea-chat__stop-icon" aria-hidden />
          </button>
        ) : (
          <button
            className="linea-chat__send"
            onClick={() => void handleSend()}
            disabled={!input.trim()}
            aria-label="Send"
            title="Send (Enter)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
