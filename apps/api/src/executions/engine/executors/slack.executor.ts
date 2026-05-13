import type { WorkflowState } from '../variable-substitution';

export interface SlackNodeData {
  action?: 'send_message' | 'send_dm' | 'list_channels';
  channel?: string;
  userId?: string;
  message?: string;
  username?: string;
  iconEmoji?: string;
}

export async function executeSlackNode(
  nodeData: SlackNodeData,
  _state: WorkflowState,
  token: string | undefined,
): Promise<unknown> {
  if (!token) throw new Error('Slack token not configured (secret name: SLACK_TOKEN)');

  const action = nodeData.action ?? 'send_message';

  switch (action) {
    case 'send_message': {
      if (!nodeData.channel) throw new Error('Slack: channel is required');
      if (!nodeData.message) throw new Error('Slack: message is required');

      const body: Record<string, unknown> = {
        channel: nodeData.channel,
        text: nodeData.message,
      };
      if (nodeData.username) body.username = nodeData.username;
      if (nodeData.iconEmoji) body.icon_emoji = nodeData.iconEmoji;

      const resp = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const json = (await resp.json()) as { ok: boolean; ts?: string; error?: string };
      if (!json.ok) throw new Error(`Slack API error: ${json.error ?? 'unknown'}`);
      return { ok: true, ts: json.ts, channel: nodeData.channel };
    }

    case 'send_dm': {
      if (!nodeData.userId) throw new Error('Slack: userId is required for DMs');
      if (!nodeData.message) throw new Error('Slack: message is required');

      // Open a DM channel first
      const openResp = await fetch('https://slack.com/api/conversations.open', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ users: nodeData.userId }),
      });
      const openJson = (await openResp.json()) as { ok: boolean; channel?: { id: string }; error?: string };
      if (!openJson.ok || !openJson.channel) {
        throw new Error(`Slack DM open failed: ${openJson.error ?? 'unknown'}`);
      }

      const dmResp = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ channel: openJson.channel.id, text: nodeData.message }),
      });
      const dmJson = (await dmResp.json()) as { ok: boolean; ts?: string; error?: string };
      if (!dmJson.ok) throw new Error(`Slack DM send failed: ${dmJson.error ?? 'unknown'}`);
      return { ok: true, ts: dmJson.ts, userId: nodeData.userId };
    }

    case 'list_channels': {
      const resp = await fetch('https://slack.com/api/conversations.list?limit=200&exclude_archived=true', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await resp.json()) as {
        ok: boolean;
        channels?: { id: string; name: string }[];
        error?: string;
      };
      if (!json.ok) throw new Error(`Slack list_channels failed: ${json.error ?? 'unknown'}`);
      return { channels: (json.channels ?? []).map((c) => ({ id: c.id, name: c.name })) };
    }

    default:
      throw new Error(`Slack: unknown action "${action}"`);
  }
}
