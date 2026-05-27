import type { WorkflowState } from '../variable-substitution';

export interface GmailNodeData {
  action?: 'send_email' | 'list_emails' | 'get_email';
  to?: string;
  subject?: string;
  body?: string;
  cc?: string;
  bcc?: string;
  maxResults?: number | string;
  query?: string;
  messageId?: string;
}

function toBase64Url(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function sanitizeHeaderValue(value: string, field: string): string {
  if (/[\r\n]/.test(value)) {
    throw new Error(
      `Gmail: "${field}" contains invalid characters (CR/LF not allowed in headers)`,
    );
  }
  return value;
}

function buildRfc2822(data: GmailNodeData): string {
  const lines: string[] = [
    `To: ${sanitizeHeaderValue(data.to ?? '', 'to')}`,
    `Subject: ${sanitizeHeaderValue(data.subject ?? '(no subject)', 'subject')}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
  ];
  if (data.cc) lines.push(`Cc: ${sanitizeHeaderValue(data.cc, 'cc')}`);
  if (data.bcc) lines.push(`Bcc: ${sanitizeHeaderValue(data.bcc, 'bcc')}`);
  lines.push('', data.body ?? '');
  return lines.join('\r\n');
}

export async function executeGmailNode(
  nodeData: GmailNodeData,
  _state: WorkflowState,
  token: string | undefined,
): Promise<unknown> {
  if (!token)
    throw new Error(
      'Gmail token not found. Connect Google in Settings → Connections or add a GMAIL_TOKEN secret.',
    );

  const action = nodeData.action ?? 'send_email';
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  async function gmailFetch(path: string, method: string, body?: unknown) {
    const resp = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me${path}`,
      {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      },
    );
    const json = (await resp.json()) as unknown;
    if (!resp.ok) {
      const err = (json as { error?: { message?: string } })?.error;
      throw new Error(
        `Gmail API error: ${err?.message ?? `HTTP ${resp.status}`}`,
      );
    }
    return json;
  }

  switch (action) {
    case 'send_email': {
      if (!nodeData.to) throw new Error('Gmail: to is required');
      const raw = toBase64Url(buildRfc2822(nodeData));
      const msg = (await gmailFetch('/messages/send', 'POST', { raw })) as {
        id: string;
        threadId: string;
      };
      return { messageId: msg.id, threadId: msg.threadId };
    }

    case 'list_emails': {
      const maxResults = Number(nodeData.maxResults ?? 10);
      const q = nodeData.query ?? 'in:inbox';
      const list = (await gmailFetch(
        `/messages?maxResults=${maxResults}&q=${encodeURIComponent(q)}`,
        'GET',
      )) as { messages?: { id: string; threadId: string }[] };
      return { messages: list.messages ?? [] };
    }

    case 'get_email': {
      if (!nodeData.messageId) throw new Error('Gmail: messageId is required');
      const msg = (await gmailFetch(
        `/messages/${nodeData.messageId}?format=metadata`,
        'GET',
      )) as {
        id: string;
        threadId: string;
        payload?: { headers?: { name: string; value: string }[] };
        snippet?: string;
      };
      const headers2 = msg.payload?.headers ?? [];
      const subject = headers2.find((h) => h.name === 'Subject')?.value;
      const from = headers2.find((h) => h.name === 'From')?.value;
      const date = headers2.find((h) => h.name === 'Date')?.value;
      return {
        id: msg.id,
        threadId: msg.threadId,
        subject,
        from,
        date,
        snippet: msg.snippet,
      };
    }

    default:
      throw new Error(`Gmail: unknown action "${String(action)}"`);
  }
}
