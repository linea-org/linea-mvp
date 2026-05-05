import { DocsPage, DocsBody, DocsTitle, DocsDescription } from 'fumadocs-ui/page';
import { getMilestones, getIssues } from '@/lib/github';
import { RoadmapView } from '@/components/roadmap-view';

const GITHUB_OWNER = process.env.GITHUB_OWNER ?? 'linea-xyz';
const GITHUB_REPO = process.env.GITHUB_REPO ?? 'linea';

export const revalidate = 3600;

export const metadata = {
  title: 'Roadmap',
  description: 'Planned features and upcoming milestones for Linea.',
};

export default async function RoadmapPage() {
  const [milestones, issues] = await Promise.all([
    getMilestones(GITHUB_OWNER, GITHUB_REPO),
    getIssues(GITHUB_OWNER, GITHUB_REPO),
  ]);

  const repoUrl = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`;

  return (
    <DocsPage full={false}>
      <DocsTitle>Roadmap</DocsTitle>
      <DocsDescription>
        Planned features and upcoming milestones.{' '}
        <a href={`${repoUrl}/issues`} target="_blank" rel="noopener noreferrer">
          View on GitHub ↗
        </a>
      </DocsDescription>
      <DocsBody>
        <RoadmapView milestones={milestones} issues={issues} repoUrl={repoUrl} />
      </DocsBody>
    </DocsPage>
  );
}
