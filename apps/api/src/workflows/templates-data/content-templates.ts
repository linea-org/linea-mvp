import type { TemplateDefinition } from './types';

export const CONTENT_TEMPLATES: TemplateDefinition[] = [
  {
    name: 'Batch Article Summarizer',
    description:
      'Fetch a list of articles from an API, filter high-quality ones, loop over them to prepare titles, then have AI write a combined summary.',
    category: 'Content',
    featured: true,
    prerequisites: [
      {
        type: 'slack',
        label: 'Slack Connection',
        description:
          'Connect Slack under Settings â†’ Connections so the digest can be posted to a channel.',
      },
      {
        type: 'model_key',
        label: 'Anthropic API Key',
        description:
          'Required by the AI summarizer node under Settings â†’ Model Keys.',
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
              { name: 'slackChannel', type: 'string', required: true },
            ],
            testInput: {
              feedUrl: 'https://hn.algolia.com/api/v1/search?tags=front_page',
              slackChannel: '#digest',
            },
          },
          position: { x: 100, y: 250 },
        },
        {
          id: 'fetch',
          type: 'http',
          data: {
            nodeType: 'http',
            label: 'Fetch Articles',
            method: 'GET',
            url: '{{input.feedUrl}}',
            headers: { Accept: 'application/json' },
          },
          position: { x: 320, y: 250 },
        },
        {
          id: 'extract',
          type: 'extract',
          data: {
            nodeType: 'extract',
            label: 'Extract Articles',
            fields: [{ name: 'articles', path: '$.articles' }],
          },
          position: { x: 540, y: 250 },
        },
        {
          id: 'filter',
          type: 'filter',
          data: {
            nodeType: 'filter',
            label: 'Filter High Score',
            source: 'articles',
            condition: 'item.score >= 4',
          },
          position: { x: 760, y: 250 },
        },
        {
          id: 'loop',
          type: 'loop',
          data: {
            nodeType: 'loop',
            label: 'Prepare Titles',
            arrayPath: 'filter',
            itemTransform: 'item.title + " â€” " + item.description',
            maxIterations: 20,
          },
          position: { x: 980, y: 250 },
        },
        {
          id: 'summarize',
          type: 'agent',
          data: {
            nodeType: 'agent',
            label: 'Write Summary',
            model: 'claude-sonnet-4-6',
            systemPrompt:
              'You write clear, engaging newsletter-style summaries. Format with bullet points using Slack mrkdwn.',
            userPrompt:
              'Write a concise summary digest of these article headlines:\n\n{{loop.results}}',
          },
          position: { x: 1200, y: 250 },
        },
        {
          id: 'post',
          type: 'slack',
          data: {
            nodeType: 'slack',
            label: 'Post to Slack',
            action: 'send_message',
            channel: '{{input.slackChannel}}',
            message: '*ðŸ“° Article Digest*\n\n{{summarize}}',
          },
          position: { x: 1420, y: 250 },
        },
        {
          id: 'end',
          type: 'end',
          data: { nodeType: 'end', label: 'End' },
          position: { x: 1640, y: 250 },
        },
      ],
      edges: [
        { id: 'e1', source: 'start', target: 'fetch' },
        { id: 'e2', source: 'fetch', target: 'extract' },
        { id: 'e3', source: 'extract', target: 'filter' },
        { id: 'e4', source: 'filter', target: 'loop' },
        { id: 'e5', source: 'loop', target: 'summarize' },
        { id: 'e6', source: 'summarize', target: 'post' },
        { id: 'e7', source: 'post', target: 'end' },
      ],
    },
  },

  {
    name: 'RAG Knowledge Base Q&A',
    description:
      'Answer user questions using your knowledge base. Retrieves relevant context, recalls prior conversation from memory, generates a grounded answer, and saves the interaction.',
    category: 'AI',
    featured: true,
    prerequisites: [
      {
        type: 'rag',
        label: 'Knowledge Base',
        description:
          'Create a Knowledge Base in the Knowledge section, upload your content, and copy its ID to use as the knowledgeBaseId input.',
      },
      {
        type: 'model_key',
        label: 'Anthropic API Key',
        description:
          'Add your Anthropic API key under Settings â†’ Model Keys so the AI agent and guardrails can run.',
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
              { name: 'knowledgeBaseId', type: 'string', required: true },
            ],
            testInput: {
              knowledgeBaseId: 'your-kb-id',
            },
          },
          position: { x: 100, y: 250 },
        },
        {
          id: 'vars',
          type: 'variables',
          data: {
            nodeType: 'variables',
            label: 'Config',
            variables: [
              { key: 'topK', value: '5' },
              {
                key: 'systemRole',
                value:
                  'You are a helpful assistant. Answer only based on the provided context.',
              },
            ],
          },
          position: { x: 320, y: 250 },
        },
        {
          id: 'guard',
          type: 'guardrails',
          data: {
            nodeType: 'guardrails',
            label: 'Safety Check',
            checks: ['pii', 'jailbreak'],
            action: 'block',
            inputKey: 'input',
          },
          position: { x: 540, y: 250 },
        },
        {
          id: 'history',
          type: 'memory',
          data: {
            nodeType: 'memory',
            label: 'Recall History',
            memoryMode: 'retrieve',
            memoryScope: 'thread',
            memoryQuery: '{{input.message}}',
            memoryTopK: 3,
          },
          position: { x: 760, y: 250 },
        },
        {
          id: 'retriever',
          type: 'retriever',
          data: {
            nodeType: 'retriever',
            label: 'Search KB',
            query: '{{input.message}}',
            knowledgeBaseId: '{{input.knowledgeBaseId}}',
            topK: 5,
            outputField: 'text',
          },
          position: { x: 980, y: 250 },
        },
        {
          id: 'merge',
          type: 'merge',
          data: {
            nodeType: 'merge',
            label: 'Merge Context',
            sources: ['history', 'retriever'],
            mode: 'merge',
          },
          position: { x: 1200, y: 250 },
        },
        {
          id: 'answer',
          type: 'agent',
          data: {
            nodeType: 'agent',
            label: 'Generate Answer',
            model: 'claude-sonnet-4-6',
            systemPrompt: '{{vars.systemRole}}',
            userPrompt:
              'Prior conversation:\n{{history.memories}}\n\nRelevant knowledge:\n{{retriever}}\n\nQuestion: {{input.message}}',
          },
          position: { x: 1420, y: 250 },
        },
        {
          id: 'save',
          type: 'memory',
          data: {
            nodeType: 'memory',
            label: 'Save to Memory',
            memoryMode: 'write',
            memoryScope: 'thread',
            memoryKey: 'last_qa',
            memoryValue: '{"q":"{{input.message}}","a":"{{answer}}"}',
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
        { id: 'e1', source: 'start', target: 'vars' },
        { id: 'e2', source: 'vars', target: 'guard' },
        { id: 'e3', source: 'guard', target: 'history' },
        { id: 'e4', source: 'history', target: 'retriever' },
        { id: 'e5', source: 'retriever', target: 'merge' },
        { id: 'e6', source: 'merge', target: 'answer' },
        { id: 'e7', source: 'answer', target: 'save' },
        { id: 'e8', source: 'save', target: 'end' },
      ],
    },
  },

  {
    name: 'Parallel Competitor Monitor',
    description:
      'Simultaneously fetch three competitor pages in parallel, merge results, ask AI to write a competitive analysis, wait briefly, then email the report.',
    category: 'Research',
    featured: true,
    prerequisites: [
      {
        type: 'gmail',
        label: 'Gmail Connection',
        description:
          'Connect your Google account under Settings â†’ Connections so the Gmail node can send the report email.',
      },
      {
        type: 'model_key',
        label: 'Anthropic API Key',
        description:
          'Required by the AI analysis node under Settings â†’ Model Keys.',
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
              { name: 'url1', type: 'string', required: true },
              { name: 'url2', type: 'string', required: true },
              { name: 'url3', type: 'string', required: true },
              { name: 'recipientEmail', type: 'string', required: true },
            ],
            testInput: {
              url1: 'https://competitor1.com',
              url2: 'https://competitor2.com',
              url3: 'https://competitor3.com',
              recipientEmail: 'you@example.com',
            },
          },
          position: { x: 100, y: 250 },
        },
        {
          id: 'vars',
          type: 'variables',
          data: {
            nodeType: 'variables',
            label: 'Set URLs',
            variables: [
              { key: 'competitor1', value: '{{input.url1}}' },
              { key: 'competitor2', value: '{{input.url2}}' },
              { key: 'competitor3', value: '{{input.url3}}' },
            ],
          },
          position: { x: 320, y: 250 },
        },
        {
          id: 'parallel',
          type: 'parallel',
          data: {
            nodeType: 'parallel',
            label: 'Fetch All Pages',
            failFast: false,
            branches: [
              {
                id: 'branch-1',
                label: 'Competitor 1',
                type: 'http',
                config: { method: 'GET', url: '{{vars.competitor1}}' },
              },
              {
                id: 'branch-2',
                label: 'Competitor 2',
                type: 'http',
                config: { method: 'GET', url: '{{vars.competitor2}}' },
              },
              {
                id: 'branch-3',
                label: 'Competitor 3',
                type: 'http',
                config: { method: 'GET', url: '{{vars.competitor3}}' },
              },
            ],
          },
          position: { x: 540, y: 250 },
        },
        {
          id: 'merge',
          type: 'merge',
          data: {
            nodeType: 'merge',
            label: 'Merge Responses',
            sources: ['parallel'],
            mode: 'concat',
          },
          position: { x: 760, y: 250 },
        },
        {
          id: 'analyze',
          type: 'agent',
          data: {
            nodeType: 'agent',
            label: 'Write Analysis',
            model: 'claude-sonnet-4-6',
            systemPrompt:
              'You are a competitive intelligence analyst. Write a structured competitive analysis covering: product features, pricing signals, messaging angles, and key differentiators.',
            userPrompt:
              'Analyze these three competitor pages and write a competitive analysis:\n\n{{parallel.results}}',
          },
          position: { x: 980, y: 250 },
        },
        {
          id: 'wait',
          type: 'wait',
          data: {
            nodeType: 'wait',
            label: 'Brief Pause',
            duration: 2,
            unit: 's',
          },
          position: { x: 1200, y: 250 },
        },
        {
          id: 'email',
          type: 'gmail',
          data: {
            nodeType: 'gmail',
            label: 'Email Report',
            action: 'send',
            to: '{{input.recipientEmail}}',
            subject: 'Competitive Analysis Report â€” {{input.url1}}',
            body: '{{analyze}}',
          },
          position: { x: 1420, y: 250 },
        },
        {
          id: 'end',
          type: 'end',
          data: { nodeType: 'end', label: 'End' },
          position: { x: 1640, y: 250 },
        },
      ],
      edges: [
        { id: 'e1', source: 'start', target: 'vars' },
        { id: 'e2', source: 'vars', target: 'parallel' },
        { id: 'e3', source: 'parallel', target: 'merge' },
        { id: 'e4', source: 'merge', target: 'analyze' },
        { id: 'e5', source: 'analyze', target: 'wait' },
        { id: 'e6', source: 'wait', target: 'email' },
        { id: 'e7', source: 'email', target: 'end' },
      ],
    },
  },
];
