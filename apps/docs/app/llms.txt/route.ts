export const dynamic = 'force-static';

export function GET() {
  const content = `# Linea

> Linea is an AI workflow automation platform. Build, deploy, and orchestrate AI agents and workflows with persistent memory, MCP tool integrations, and multi-step execution.

## Documentation

- [Overview](/docs): Introduction and getting started
- [Architecture](/docs/architecture/overview): System design, component diagrams, and core concepts
- [Modules](/docs/modules): Platform module documentation
- [API Reference](/docs/reference): Complete REST API documentation

## API Reference

- [Authentication](/docs/reference/intro): Bearer tokens and API key auth
- [Workspaces](/docs/reference/workspaces): Workspace CRUD, member management, roles (viewer/editor/admin/owner), invites
- [Spaces](/docs/reference/spaces): Logical containers for workflows within a workspace
- [Workflows](/docs/reference/workflows): Create, deploy, version, star, trash, and restore workflows; clone from templates
- [Executions](/docs/reference/executions): Trigger executions, stream live events via SSE, respond to human-in-the-loop steps, cancel runs
- [Memory](/docs/reference/memory): Ingest and search AI agent memory; hybrid vector+keyword search; user profiles grouped by fact type
- [Knowledge Bases](/docs/reference/knowledge): Document stores with auto-embedding; semantic search via pgvector
- [MCP Servers](/docs/reference/mcp): Register Model Context Protocol tool servers; sync tools with vector embeddings for semantic discovery
- [Triggers](/docs/reference/triggers): Cron schedules and inbound webhooks to automate workflow execution
- [Notifications](/docs/reference/notifications): In-app notification list, read, and delete
- [API Keys](/docs/reference/api-keys): Create and revoke workspace-scoped API keys

## Key Concepts

- **Workspace**: Top-level organisation/team container. Members have roles: viewer, editor, admin, owner.
- **Space**: Logical grouping inside a workspace (e.g. Production, Staging). Workflows and executions live here.
- **Workflow**: A definition of an AI agent process. Has a \`definition\` JSONB field for the visual step graph.
- **Execution**: A single run of a workflow. Statuses: pending → running → completed/failed/suspended/cancelled.
- **Memory**: Atomic facts extracted from agent conversations. Scoped by thread, workflow, or user. Superseded facts are excluded from results.
- **Knowledge Base**: Vector-searchable document store. Entries are embedded asynchronously via pgvector.
- **MCP Server**: External tool server conforming to the Model Context Protocol. Tools are embedded for semantic discovery.

## Authentication

All API requests require \`Authorization: Bearer <token>\`. Tokens are either user session tokens or workspace API keys (prefix: \`lnk_live_\`).
`;

  return new Response(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
