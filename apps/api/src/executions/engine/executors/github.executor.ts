import type { WorkflowState } from '../variable-substitution';

export interface GitHubNodeData {
  action?: 'create_issue' | 'comment_issue' | 'list_issues' | 'create_pr';
  owner?: string;
  repo?: string;
  title?: string;
  body?: string;
  labels?: string; // comma-separated
  issueNumber?: number | string;
  head?: string;
  base?: string;
}

export async function executeGitHubNode(
  nodeData: GitHubNodeData,
  _state: WorkflowState,
  token: string | undefined,
): Promise<unknown> {
  if (!token)
    throw new Error(
      'GitHub token not found. Connect GitHub in Settings → Connections or add a GITHUB_TOKEN secret.',
    );
  if (!nodeData.owner) throw new Error('GitHub: owner is required');
  if (!nodeData.repo) throw new Error('GitHub: repo is required');

  const action = nodeData.action ?? 'create_issue';
  const baseUrl = `https://api.github.com/repos/${nodeData.owner}/${nodeData.repo}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };

  async function ghFetch(path: string, method: string, body?: unknown) {
    const resp = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const json = (await resp.json()) as unknown;
    if (!resp.ok) {
      const msg =
        (json as { message?: string })?.message ?? `HTTP ${resp.status}`;
      throw new Error(`GitHub API error: ${msg}`);
    }
    return json;
  }

  switch (action) {
    case 'create_issue': {
      if (!nodeData.title)
        throw new Error('GitHub: title is required to create an issue');
      const labels = nodeData.labels
        ? nodeData.labels
            .split(',')
            .map((l) => l.trim())
            .filter(Boolean)
        : undefined;
      const issue = (await ghFetch('/issues', 'POST', {
        title: nodeData.title,
        body: nodeData.body,
        ...(labels?.length ? { labels } : {}),
      })) as { number: number; html_url: string };
      return { number: issue.number, url: issue.html_url };
    }

    case 'comment_issue': {
      if (!nodeData.issueNumber)
        throw new Error('GitHub: issueNumber is required to comment');
      if (!nodeData.body)
        throw new Error('GitHub: body is required for a comment');
      const comment = (await ghFetch(
        `/issues/${nodeData.issueNumber}/comments`,
        'POST',
        {
          body: nodeData.body,
        },
      )) as { id: number; html_url: string };
      return { id: comment.id, url: comment.html_url };
    }

    case 'list_issues': {
      const issues = (await ghFetch(
        '/issues?state=open&per_page=50',
        'GET',
      )) as {
        number: number;
        title: string;
        state: string;
        html_url: string;
      }[];
      return {
        issues: issues.map((i) => ({
          number: i.number,
          title: i.title,
          state: i.state,
          url: i.html_url,
        })),
      };
    }

    case 'create_pr': {
      if (!nodeData.title)
        throw new Error('GitHub: title is required to create a PR');
      if (!nodeData.head) throw new Error('GitHub: head branch is required');
      if (!nodeData.base) throw new Error('GitHub: base branch is required');
      const pr = (await ghFetch('/pulls', 'POST', {
        title: nodeData.title,
        body: nodeData.body,
        head: nodeData.head,
        base: nodeData.base,
      })) as { number: number; html_url: string };
      return { number: pr.number, url: pr.html_url };
    }

    default:
      throw new Error(`GitHub: unknown action "${String(action)}"`);
  }
}
