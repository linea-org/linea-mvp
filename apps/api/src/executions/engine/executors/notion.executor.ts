import type { WorkflowState } from '../variable-substitution.js';

export interface NotionNodeData {
  action?: 'create_page' | 'append_block' | 'query_database' | 'get_page';
  databaseId?: string;
  pageId?: string;
  title?: string;
  content?: string;
  /** JSON string of Notion filter object */
  filter?: string;
}

export async function executeNotionNode(
  nodeData: NotionNodeData,
  _state: WorkflowState,
  token: string | undefined,
): Promise<unknown> {
  if (!token)
    throw new Error(
      'Notion token not found. Connect Notion in Settings → Connections or add a NOTION_TOKEN secret.',
    );

  const action = nodeData.action ?? 'create_page';
  const headers = {
    Authorization: `Bearer ${token}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  };

  async function notionFetch(path: string, method: string, body?: unknown) {
    const resp = await fetch(`https://api.notion.com/v1${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const json = (await resp.json()) as unknown;
    if (!resp.ok) {
      const err = json as { message?: string };
      throw new Error(
        `Notion API error: ${err.message ?? `HTTP ${resp.status}`}`,
      );
    }
    return json;
  }

  switch (action) {
    case 'create_page': {
      if (!nodeData.databaseId)
        throw new Error('Notion: databaseId is required to create a page');
      const body: Record<string, unknown> = {
        parent: { database_id: nodeData.databaseId },
        properties: {},
      };
      if (nodeData.title) {
        body.properties = {
          Name: { title: [{ text: { content: nodeData.title } }] },
        };
      }
      if (nodeData.content) {
        body.children = [
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [
                { type: 'text', text: { content: nodeData.content } },
              ],
            },
          },
        ];
      }
      const page = (await notionFetch('/pages', 'POST', body)) as {
        id: string;
        url: string;
      };
      return { id: page.id, url: page.url };
    }

    case 'append_block': {
      if (!nodeData.pageId)
        throw new Error('Notion: pageId is required to append blocks');
      if (!nodeData.content)
        throw new Error('Notion: content is required to append blocks');
      await notionFetch(`/blocks/${nodeData.pageId}/children`, 'PATCH', {
        children: [
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [
                { type: 'text', text: { content: nodeData.content } },
              ],
            },
          },
        ],
      });
      return { ok: true, pageId: nodeData.pageId };
    }

    case 'query_database': {
      if (!nodeData.databaseId)
        throw new Error('Notion: databaseId is required to query');
      let filter: unknown = undefined;
      if (nodeData.filter) {
        try {
          filter = JSON.parse(nodeData.filter);
        } catch {
          /* ignore */
        }
      }
      const result = (await notionFetch(
        `/databases/${nodeData.databaseId}/query`,
        'POST',
        {
          ...(filter ? { filter } : {}),
          page_size: 50,
        },
      )) as { results: { id: string; url: string }[] };
      return { pages: result.results.map((p) => ({ id: p.id, url: p.url })) };
    }

    case 'get_page': {
      if (!nodeData.pageId)
        throw new Error('Notion: pageId is required to get page');
      const page = (await notionFetch(`/pages/${nodeData.pageId}`, 'GET')) as {
        id: string;
        url: string;
        properties: unknown;
      };
      return { id: page.id, url: page.url, properties: page.properties };
    }

    default:
      throw new Error(`Notion: unknown action "${String(action)}"`);
  }
}
