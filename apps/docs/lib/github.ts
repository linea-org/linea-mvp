export interface GitHubMilestone {
  id: number;
  number: number;
  title: string;
  description: string | null;
  state: 'open' | 'closed';
  open_issues: number;
  closed_issues: number;
  html_url: string;
  due_on: string | null;
}

interface GitHubLabel {
  name: string;
  color: string;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  html_url: string;
  labels: GitHubLabel[];
  milestone: Pick<GitHubMilestone, 'number' | 'title'> | null;
  created_at: string;
  updated_at: string;
  pull_request?: unknown;
}

async function ghFetch<T>(path: string): Promise<T | null> {
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`https://api.github.com${path}`, {
      headers,
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

export async function getMilestones(owner: string, repo: string): Promise<GitHubMilestone[]> {
  const data = await ghFetch<GitHubMilestone[]>(
    `/repos/${owner}/${repo}/milestones?state=all&per_page=50&sort=due_on&direction=asc`,
  );
  return data ?? [];
}

export async function getIssues(owner: string, repo: string): Promise<GitHubIssue[]> {
  const data = await ghFetch<GitHubIssue[]>(
    `/repos/${owner}/${repo}/issues?state=all&per_page=100`,
  );
  // filter out pull requests
  return (data ?? []).filter((i) => !i.pull_request);
}
