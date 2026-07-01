import type { TemplateDefinition } from './types';

export const INTEGRATION_TEMPLATES: TemplateDefinition[] = [
  {
    name: 'Scheduled Metrics Digest',
    description:
      'Get the current timestamp, recall the last run from memory, fetch fresh metrics, compute the delta with a transform, save the new baseline, then send reports via Slack and email.',
    category: 'Analytics',
    featured: false,
    prerequisites: [
      {
        type: 'slack',
        label: 'Slack Connection',
        description:
          'Connect Slack under Settings â†’ Connections for digest posting.',
      },
      {
        type: 'gmail',
        label: 'Gmail Connection',
        description:
          'Connect Gmail under Settings â†’ Connections for email delivery.',
      },
      {
        type: 'model_key',
        label: 'Anthropic API Key',
        description:
          'Required by the AI digest writer under Settings â†’ Model Keys.',
      },
    ],
    definition: {
      nodes: [
        {
          id: 'start',
          type: 'start',
          data: {
            nodeType: 'start',
            label: 'Start',
            triggerType: 'webhook',
            inputVariables: [
              { name: 'metricsUrl', type: 'string', required: true },
              { name: 'apiToken', type: 'string', required: true },
              { name: 'slackChannel', type: 'string', required: true },
              { name: 'reportEmail', type: 'string', required: true },
            ],
            testInput: {
              metricsUrl: 'https://api.example.com/metrics',
              apiToken: 'your-api-token',
              slackChannel: '#metrics',
              reportEmail: 'team@example.com',
            },
          },
          position: { x: 100, y: 250 },
        },
        {
          id: 'ts',
          type: 'datetime',
          data: {
            nodeType: 'datetime',
            label: 'Current Time',
            operation: 'now',
            format: 'YYYY-MM-DD HH:mm',
          },
          position: { x: 320, y: 250 },
        },
        {
          id: 'recall',
          type: 'memory',
          data: {
            nodeType: 'memory',
            label: 'Recall Last Run',
            memoryMode: 'retrieve',
            memoryScope: 'workflow',
            memoryQuery: 'metrics_baseline',
            memoryTopK: 1,
          },
          position: { x: 540, y: 250 },
        },
        {
          id: 'metrics',
          type: 'http',
          data: {
            nodeType: 'http',
            label: 'Fetch Metrics',
            method: 'GET',
            url: '{{input.metricsUrl}}',
            headers: { Authorization: 'Bearer {{input.apiToken}}' },
          },
          position: { x: 760, y: 250 },
        },
        {
          id: 'delta',
          type: 'transform',
          data: {
            nodeType: 'transform',
            label: 'Compute Delta',
            code: `const current = input.metrics;
const prev = input.recall?.memories?.[0]?.value ?? {};
return {
  revenue: current.revenue,
  revenueDelta: current.revenue - (prev.revenue ?? 0),
  dau: current.dau,
  dauDelta: current.dau - (prev.dau ?? 0),
  errors: current.errors,
  errorsDelta: current.errors - (prev.errors ?? 0),
  period: input.ts?.formatted,
};`,
          },
          position: { x: 980, y: 250 },
        },
        {
          id: 'digest',
          type: 'agent',
          data: {
            nodeType: 'agent',
            label: 'Write Digest',
            model: 'claude-sonnet-4-6',
            systemPrompt:
              'Write a concise, executive-style metrics digest. Use emoji indicators (ðŸ“ˆ up, ðŸ“‰ down, âž¡ï¸ flat). Keep it under 200 words.',
            userPrompt: 'Write a digest from this metrics delta:\n\n{{delta}}',
          },
          position: { x: 1200, y: 250 },
        },
        {
          id: 'save',
          type: 'memory',
          data: {
            nodeType: 'memory',
            label: 'Save Baseline',
            memoryMode: 'write',
            memoryScope: 'workflow',
            memoryKey: 'metrics_baseline',
            memoryValue: '{{metrics}}',
          },
          position: { x: 1420, y: 250 },
        },
        {
          id: 'slack',
          type: 'slack',
          data: {
            nodeType: 'slack',
            label: 'Post to Slack',
            action: 'send_message',
            channel: '{{input.slackChannel}}',
            message: '*ðŸ“Š Metrics Digest â€” {{ts.formatted}}*\n\n{{digest}}',
          },
          position: { x: 1640, y: 150 },
        },
        {
          id: 'email',
          type: 'gmail',
          data: {
            nodeType: 'gmail',
            label: 'Email Report',
            action: 'send',
            to: '{{input.reportEmail}}',
            subject: 'Metrics Digest â€” {{ts.formatted}}',
            body: '{{digest}}\n\nRaw data: {{delta}}',
          },
          position: { x: 1640, y: 350 },
        },
        {
          id: 'end',
          type: 'end',
          data: { nodeType: 'end', label: 'End' },
          position: { x: 1860, y: 250 },
        },
      ],
      edges: [
        { id: 'e1', source: 'start', target: 'ts' },
        { id: 'e2', source: 'ts', target: 'recall' },
        { id: 'e3', source: 'recall', target: 'metrics' },
        { id: 'e4', source: 'metrics', target: 'delta' },
        { id: 'e5', source: 'delta', target: 'digest' },
        { id: 'e6', source: 'digest', target: 'save' },
        { id: 'e7', source: 'save', target: 'slack' },
        { id: 'e8', source: 'save', target: 'email' },
        { id: 'e9', source: 'slack', target: 'end' },
        { id: 'e10', source: 'email', target: 'end' },
      ],
    },
  },

  {
    name: 'GitHub PR Auto-Reviewer',
    description:
      'Fetch a pull request diff from GitHub, run jailbreak guardrails on the PR body, generate an AI code review, score its quality with an evaluator, filter out low-quality reviews, then post a comment and notify Slack.',
    category: 'DevOps',
    featured: true,
    prerequisites: [
      {
        type: 'github',
        label: 'GitHub Connection',
        description:
          'Connect your GitHub account under Settings â†’ Connections. The bot needs read access to PRs and write access to comments.',
      },
      {
        type: 'slack',
        label: 'Slack Connection',
        description:
          'Connect Slack for team notifications when a review is posted.',
      },
      {
        type: 'model_key',
        label: 'Anthropic API Key',
        description:
          'Required by the AI reviewer and evaluator nodes under Settings â†’ Model Keys.',
      },
    ],
    definition: {
      nodes: [
        {
          id: 'start',
          type: 'start',
          data: {
            nodeType: 'start',
            label: 'Start',
            triggerType: 'webhook',
            inputVariables: [
              { name: 'owner', type: 'string', required: true },
              { name: 'repo', type: 'string', required: true },
              { name: 'prNumber', type: 'string', required: true },
              { name: 'slackChannel', type: 'string', required: true },
            ],
            testInput: {
              owner: 'myorg',
              repo: 'myrepo',
              prNumber: '42',
              slackChannel: '#engineering',
            },
          },
          position: { x: 100, y: 250 },
        },
        {
          id: 'vars',
          type: 'variables',
          data: {
            nodeType: 'variables',
            label: 'PR Config',
            variables: [
              { key: 'owner', value: '{{input.owner}}' },
              { key: 'repo', value: '{{input.repo}}' },
              { key: 'pr', value: '{{input.prNumber}}' },
            ],
          },
          position: { x: 320, y: 250 },
        },
        {
          id: 'ghfetch',
          type: 'github',
          data: {
            nodeType: 'github',
            label: 'Fetch PR',
            action: 'get_pull_request',
            owner: '{{vars.owner}}',
            repo: '{{vars.repo}}',
            pullNumber: '{{vars.pr}}',
          },
          position: { x: 540, y: 250 },
        },
        {
          id: 'guard',
          type: 'guardrails',
          data: {
            nodeType: 'guardrails',
            label: 'Check PR Body',
            checks: ['jailbreak', 'moderation'],
            action: 'block',
            inputKey: 'ghfetch',
          },
          position: { x: 760, y: 250 },
        },
        {
          id: 'review',
          type: 'agent',
          data: {
            nodeType: 'agent',
            label: 'Write Review',
            model: 'claude-sonnet-4-6',
            systemPrompt:
              'You are a senior software engineer doing a code review. Be concise, specific, and constructive. Focus on: correctness, security, performance, and readability. Format as GitHub markdown with sections.',
            userPrompt:
              'Review this pull request:\n\nTitle: {{ghfetch.title}}\nDescription: {{ghfetch.body}}\n\nFiles changed: {{ghfetch.changedFiles}}\nAdditions: {{ghfetch.additions}} | Deletions: {{ghfetch.deletions}}',
          },
          position: { x: 980, y: 250 },
        },
        {
          id: 'eval',
          type: 'evaluator',
          data: {
            nodeType: 'evaluator',
            label: 'Score Review',
            criteria:
              'Score this PR review on: (1) specificity â€” does it reference actual code rather than vague generalities? (2) actionability â€” are suggestions concrete and implementable? (3) completeness â€” does it cover security and correctness?',
            input: '{{review}}',
            scoreMin: 0,
            scoreMax: 10,
            passThreshold: 0.5,
          },
          position: { x: 1200, y: 250 },
        },
        {
          id: 'filter',
          type: 'filter',
          data: {
            nodeType: 'filter',
            label: 'Only Post if Good',
            source: 'eval',
            condition: 'item.passed == true',
          },
          position: { x: 1420, y: 250 },
        },
        {
          id: 'comment',
          type: 'github',
          data: {
            nodeType: 'github',
            label: 'Post Review Comment',
            action: 'create_comment',
            owner: '{{vars.owner}}',
            repo: '{{vars.repo}}',
            issueNumber: '{{vars.pr}}',
            body: '## ðŸ¤– Automated Code Review\n\n{{review}}\n\n---\n_Review quality score: {{eval.score}}/10_',
          },
          position: { x: 1640, y: 250 },
        },
        {
          id: 'notify',
          type: 'slack',
          data: {
            nodeType: 'slack',
            label: 'Notify Team',
            action: 'send_message',
            channel: '{{input.slackChannel}}',
            message:
              'ðŸ” *PR Review Posted*\n<{{ghfetch.html_url}}|{{ghfetch.title}}> ({{vars.owner}}/{{vars.repo}} #{{vars.pr}})\nQuality score: {{eval.score}}/10',
          },
          position: { x: 1860, y: 250 },
        },
        {
          id: 'end',
          type: 'end',
          data: { nodeType: 'end', label: 'End' },
          position: { x: 2080, y: 250 },
        },
      ],
      edges: [
        { id: 'e1', source: 'start', target: 'vars' },
        { id: 'e2', source: 'vars', target: 'ghfetch' },
        { id: 'e3', source: 'ghfetch', target: 'guard' },
        { id: 'e4', source: 'guard', target: 'review' },
        { id: 'e5', source: 'review', target: 'eval' },
        { id: 'e6', source: 'eval', target: 'filter' },
        { id: 'e7', source: 'filter', target: 'comment' },
        { id: 'e8', source: 'comment', target: 'notify' },
        { id: 'e9', source: 'notify', target: 'end' },
      ],
    },
  },

  {
    name: 'Notion CRM Lead Pipeline',
    description:
      'Receive lead data from a webhook, extract key CRM fields, set variable defaults, redact PII before AI enrichment, create a Notion page, and notify the sales team on Slack.',
    category: 'Sales',
    featured: false,
    prerequisites: [
      {
        type: 'notion',
        label: 'Notion Connection + CRM Database',
        description:
          'Connect Notion under Settings â†’ Connections. Create a database with columns: Name, Company, Role, Email, Stage, Source, Urgency, Use Case, Company Stage, Created, Owner. Copy the database ID.',
      },
      {
        type: 'slack',
        label: 'Slack Connection',
        description:
          'Connect Slack for sales team alerts when a new lead arrives.',
      },
      {
        type: 'model_key',
        label: 'Anthropic API Key',
        description:
          'Required by the AI enrichment node under Settings â†’ Model Keys.',
      },
    ],
    definition: {
      nodes: [
        {
          id: 'start',
          type: 'start',
          data: {
            nodeType: 'start',
            label: 'Start',
            triggerType: 'webhook',
            inputVariables: [
              { name: 'name', type: 'string', required: true },
              { name: 'email', type: 'string', required: true },
              { name: 'company', type: 'string', required: true },
              { name: 'title', type: 'string', required: false },
              { name: 'source', type: 'string', required: false },
              { name: 'message', type: 'string', required: false },
              { name: 'defaultOwner', type: 'string', required: true },
              { name: 'notionDatabaseId', type: 'string', required: true },
              { name: 'salesChannel', type: 'string', required: true },
            ],
            testInput: {
              name: 'Jane Doe',
              email: 'jane@example.com',
              company: 'Acme Corp',
              title: 'CTO',
              source: 'website',
              message: 'I need help with enterprise pricing.',
              defaultOwner: 'sales-team',
              notionDatabaseId: 'your-notion-db-id',
              salesChannel: '#sales',
            },
          },
          position: { x: 100, y: 250 },
        },
        {
          id: 'extract',
          type: 'extract',
          data: {
            nodeType: 'extract',
            label: 'Extract Lead Fields',
            fields: [
              { name: 'name', path: '$.name' },
              { name: 'email', path: '$.email' },
              { name: 'company', path: '$.company' },
              { name: 'role', path: '$.title' },
              { name: 'source', path: '$.source' },
              { name: 'message', path: '$.message' },
            ],
          },
          position: { x: 320, y: 250 },
        },
        {
          id: 'vars',
          type: 'variables',
          data: {
            nodeType: 'variables',
            label: 'Set Defaults',
            variables: [
              { key: 'stage', value: 'New' },
              { key: 'priority', value: 'Medium' },
              { key: 'owner', value: '{{input.defaultOwner}}' },
            ],
          },
          position: { x: 540, y: 250 },
        },
        {
          id: 'ts',
          type: 'datetime',
          data: {
            nodeType: 'datetime',
            label: 'Timestamp',
            operation: 'now',
            format: 'YYYY-MM-DD',
          },
          position: { x: 760, y: 250 },
        },
        {
          id: 'guard',
          type: 'guardrails',
          data: {
            nodeType: 'guardrails',
            label: 'Redact PII',
            checks: ['pii'],
            action: 'redact',
            inputKey: 'message',
          },
          position: { x: 980, y: 250 },
        },
        {
          id: 'enrich',
          type: 'agent',
          data: {
            nodeType: 'agent',
            label: 'Enrich Lead',
            model: 'claude-sonnet-4-6',
            systemPrompt:
              'You enrich CRM lead records. Based on name, company, role, and their message, infer: company stage (startup/smb/enterprise), likely use case, and urgency (low/medium/high). Reply with JSON only.',
            userPrompt:
              'Lead: {{extract.name}}, {{extract.role}} at {{extract.company}}.\nMessage (sanitised): {{guard.redactedText}}\n\nReturn JSON: {"companyStage":"...","useCase":"...","urgency":"...","notes":"..."}',
            outputSchema:
              '{"type":"object","properties":{"companyStage":{"type":"string"},"useCase":{"type":"string"},"urgency":{"type":"string"},"notes":{"type":"string"}},"required":["companyStage","useCase","urgency"]}',
          },
          position: { x: 1200, y: 250 },
        },
        {
          id: 'notion',
          type: 'notion',
          data: {
            nodeType: 'notion',
            label: 'Create Notion Record',
            action: 'create_page',
            databaseId: '{{input.notionDatabaseId}}',
            properties: {
              Name: { title: [{ text: { content: '{{extract.name}}' } }] },
              Company: {
                rich_text: [{ text: { content: '{{extract.company}}' } }],
              },
              Role: { rich_text: [{ text: { content: '{{extract.role}}' } }] },
              Email: { email: '{{extract.email}}' },
              Stage: { select: { name: '{{vars.stage}}' } },
              Source: { select: { name: '{{extract.source}}' } },
              Urgency: { select: { name: '{{enrich.urgency}}' } },
              'Use Case': {
                rich_text: [{ text: { content: '{{enrich.useCase}}' } }],
              },
              'Company Stage': { select: { name: '{{enrich.companyStage}}' } },
              Created: { date: { start: '{{ts.formatted}}' } },
              Owner: { rich_text: [{ text: { content: '{{vars.owner}}' } }] },
            },
          },
          position: { x: 1420, y: 250 },
        },
        {
          id: 'slack',
          type: 'slack',
          data: {
            nodeType: 'slack',
            label: 'Notify Sales',
            action: 'send_message',
            channel: '{{input.salesChannel}}',
            message:
              'ðŸ‘¤ *New Lead â€” {{extract.name}}*\n*{{extract.role}}* at *{{extract.company}}*\nSource: {{extract.source}} | Urgency: {{enrich.urgency}}\nUse case: {{enrich.useCase}}\n_{{enrich.notes}}_',
          },
          position: { x: 1640, y: 250 },
        },
        {
          id: 'end',
          type: 'end',
          data: { nodeType: 'end', label: 'End' },
          position: { x: 1860, y: 250 },
        },
      ],
      edges: [
        { id: 'e1', source: 'start', target: 'extract' },
        { id: 'e2', source: 'extract', target: 'vars' },
        { id: 'e3', source: 'vars', target: 'ts' },
        { id: 'e4', source: 'ts', target: 'guard' },
        { id: 'e5', source: 'guard', target: 'enrich' },
        { id: 'e6', source: 'enrich', target: 'notion' },
        { id: 'e7', source: 'notion', target: 'slack' },
        { id: 'e8', source: 'slack', target: 'end' },
      ],
    },
  },
];
