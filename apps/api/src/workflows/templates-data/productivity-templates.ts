import type { TemplateDefinition } from './types';

export const PRODUCTIVITY_TEMPLATES: TemplateDefinition[] = [
  {
    name: 'Web Scraper & Summarizer',
    description:
      'Fetch any URL and get an AI-generated summary of the content.',
    category: 'Productivity',
    featured: true,
    definition: {
      nodes: [
        {
          id: 'start',
          type: 'start',
          data: {
            nodeType: 'start',
            label: 'Start',
            triggerType: 'webhook',
            inputVariables: [{ name: 'url', type: 'string', required: true }],
            testInput: {
              url: 'https://example.com',
            },
          },
          position: { x: 100, y: 200 },
        },
        {
          id: 'fetch',
          type: 'http',
          data: {
            nodeType: 'http',
            label: 'Fetch URL',
            method: 'GET',
            url: '{{input.url}}',
          },
          position: { x: 320, y: 200 },
        },
        {
          id: 'summarize',
          type: 'agent',
          data: {
            nodeType: 'agent',
            label: 'Summarize',
            model: 'claude-sonnet-4-6',
            systemPrompt:
              'Summarize the following webpage content in 3-5 sentences.',
            userPrompt: '{{fetch}}',
          },
          position: { x: 540, y: 200 },
        },
        {
          id: 'end',
          type: 'end',
          data: { nodeType: 'end', label: 'End' },
          position: { x: 760, y: 200 },
        },
      ],
      edges: [
        { id: 'e1', source: 'start', target: 'fetch' },
        { id: 'e2', source: 'fetch', target: 'summarize' },
        { id: 'e3', source: 'summarize', target: 'end' },
      ],
    },
  },

  {
    name: 'Slack Daily Digest',
    description:
      'Fetch news from an API, summarize highlights, and post to a Slack channel.',
    category: 'Communication',
    featured: true,
    prerequisites: [
      {
        type: 'slack',
        label: 'Slack Connection',
        description:
          'Connect your Slack workspace under Settings â†’ Connections so the Slack node can post messages.',
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
              { name: 'feedUrl', type: 'string', required: true },
              { name: 'channel', type: 'string', required: true },
            ],
            testInput: {
              feedUrl: 'https://hn.algolia.com/api/v1/search?tags=front_page',
              channel: '#general',
            },
          },
          position: { x: 100, y: 200 },
        },
        {
          id: 'fetch',
          type: 'http',
          data: {
            nodeType: 'http',
            label: 'Fetch News',
            method: 'GET',
            url: '{{input.feedUrl}}',
          },
          position: { x: 320, y: 200 },
        },
        {
          id: 'digest',
          type: 'agent',
          data: {
            nodeType: 'agent',
            label: 'Write Digest',
            model: 'claude-sonnet-4-6',
            systemPrompt:
              'You create concise daily digest messages for Slack. Format using Slack mrkdwn.',
            userPrompt: 'Write a digest from this content: {{fetch}}',
          },
          position: { x: 540, y: 200 },
        },
        {
          id: 'post',
          type: 'slack',
          data: {
            nodeType: 'slack',
            label: 'Post to Slack',
            action: 'send_message',
            channel: '{{input.channel}}',
            message: '{{digest}}',
          },
          position: { x: 760, y: 200 },
        },
        {
          id: 'end',
          type: 'end',
          data: { nodeType: 'end', label: 'End' },
          position: { x: 980, y: 200 },
        },
      ],
      edges: [
        { id: 'e1', source: 'start', target: 'fetch' },
        { id: 'e2', source: 'fetch', target: 'digest' },
        { id: 'e3', source: 'digest', target: 'post' },
        { id: 'e4', source: 'post', target: 'end' },
      ],
    },
  },

  {
    name: 'Data Extraction Pipeline',
    description:
      'Fetch structured data from an API, extract specific fields, and transform the output.',
    category: 'Data',
    featured: true,
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
              { name: 'apiUrl', type: 'string', required: true },
              { name: 'token', type: 'string', required: false },
            ],
            testInput: {
              apiUrl: 'https://api.example.com/data',
              token: 'your-api-token',
            },
          },
          position: { x: 100, y: 200 },
        },
        {
          id: 'fetch',
          type: 'http',
          data: {
            nodeType: 'http',
            label: 'Fetch Data',
            method: 'GET',
            url: '{{input.apiUrl}}',
            headers: { Authorization: 'Bearer {{input.token}}' },
          },
          position: { x: 320, y: 200 },
        },
        {
          id: 'extract',
          type: 'extract',
          data: {
            nodeType: 'extract',
            label: 'Extract Fields',
            fields: [{ name: 'items', path: '$.data' }],
          },
          position: { x: 540, y: 200 },
        },
        {
          id: 'transform',
          type: 'transform',
          data: {
            nodeType: 'transform',
            label: 'Transform',
            code: 'return input.items.map(i => ({ id: i.id, name: i.name }))',
          },
          position: { x: 760, y: 200 },
        },
        {
          id: 'end',
          type: 'end',
          data: { nodeType: 'end', label: 'End' },
          position: { x: 980, y: 200 },
        },
      ],
      edges: [
        { id: 'e1', source: 'start', target: 'fetch' },
        { id: 'e2', source: 'fetch', target: 'extract' },
        { id: 'e3', source: 'extract', target: 'transform' },
        { id: 'e4', source: 'transform', target: 'end' },
      ],
    },
  },

  {
    name: 'GitHub Issue Triage',
    description:
      'Analyze incoming issue text with AI, classify its priority, and create a labelled GitHub issue.',
    category: 'DevOps',
    featured: false,
    prerequisites: [
      {
        type: 'github',
        label: 'GitHub Connection',
        description:
          'Connect your GitHub account under Settings â†’ Connections to allow the GitHub node to create issues.',
      },
      {
        type: 'model_key',
        label: 'Anthropic API Key',
        description:
          'Add your Anthropic API key under Settings â†’ Model Keys for AI-powered triage.',
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
            triggerType: 'manual',
            inputVariables: [
              { name: 'owner', type: 'string', required: true },
              { name: 'repo', type: 'string', required: true },
            ],
            testInput: {
              owner: 'myorg',
              repo: 'myrepo',
            },
          },
          position: { x: 100, y: 200 },
        },
        {
          id: 'triage',
          type: 'agent',
          data: {
            nodeType: 'agent',
            label: 'Triage',
            model: 'claude-sonnet-4-6',
            systemPrompt:
              'Classify the bug report as critical, high, medium, or low priority. Reply with JSON: {"priority":"<level>","labels":["bug"],"summary":"<one line>"}',
            userPrompt: '{{input.message}}',
            outputSchema:
              '{"type":"object","properties":{"priority":{"type":"string"},"labels":{"type":"array","items":{"type":"string"}},"summary":{"type":"string"}},"required":["priority","labels","summary"]}',
          },
          position: { x: 320, y: 200 },
        },
        {
          id: 'create',
          type: 'github',
          data: {
            nodeType: 'github',
            label: 'Create Issue',
            action: 'create_issue',
            owner: '{{input.owner}}',
            repo: '{{input.repo}}',
            title: '{{triage.summary}}',
            body: '{{input.message}}\n\n**Priority:** {{triage.priority}}',
            labels: '{{triage.labels}}',
          },
          position: { x: 540, y: 200 },
        },
        {
          id: 'end',
          type: 'end',
          data: { nodeType: 'end', label: 'End' },
          position: { x: 760, y: 200 },
        },
      ],
      edges: [
        { id: 'e1', source: 'start', target: 'triage' },
        { id: 'e2', source: 'triage', target: 'create' },
        { id: 'e3', source: 'create', target: 'end' },
      ],
    },
  },

  {
    name: 'Approval Workflow',
    description:
      'Process a request, pause for human approval, then take action based on the decision.',
    category: 'Automation',
    featured: false,
    definition: {
      nodes: [
        {
          id: 'start',
          type: 'start',
          data: {
            nodeType: 'start',
            label: 'Start',
            triggerType: 'manual',
            inputVariables: [
              { name: 'callbackUrl', type: 'string', required: true },
            ],
            testInput: {
              callbackUrl: 'https://example.com/webhook',
            },
          },
          position: { x: 100, y: 200 },
        },
        {
          id: 'review',
          type: 'agent',
          data: {
            nodeType: 'agent',
            label: 'Prepare Summary',
            model: 'claude-sonnet-4-6',
            systemPrompt:
              'Summarize the request so a human reviewer can quickly decide to approve or reject.',
            userPrompt: '{{input.message}}',
          },
          position: { x: 320, y: 200 },
        },
        {
          id: 'approval',
          type: 'approval',
          data: {
            nodeType: 'approval',
            label: 'Await Approval',
            message: '{{review}}',
          },
          position: { x: 540, y: 200 },
        },
        {
          id: 'notify',
          type: 'http',
          data: {
            nodeType: 'http',
            label: 'Notify',
            method: 'POST',
            url: '{{input.callbackUrl}}',
            body: '{"approved":true,"summary":"{{review}}"}',
          },
          position: { x: 760, y: 200 },
        },
        {
          id: 'end',
          type: 'end',
          data: { nodeType: 'end', label: 'End' },
          position: { x: 980, y: 200 },
        },
      ],
      edges: [
        { id: 'e1', source: 'start', target: 'review' },
        { id: 'e2', source: 'review', target: 'approval' },
        { id: 'e3', source: 'approval', target: 'notify' },
        { id: 'e4', source: 'notify', target: 'end' },
      ],
    },
  },
];
