import type { TemplateDefinition } from './types.js';

export const AI_OPS_TEMPLATES: TemplateDefinition[] = [
  {
    name: 'AI Lead Qualifier',
    description:
      'Fetch lead data, extract key fields, use AI to qualify it, score with an evaluator, then route high-quality leads to Notion and low-quality to a rejection webhook.',
    category: 'Sales',
    featured: true,
    prerequisites: [
      {
        type: 'notion',
        label: 'Notion Connection',
        description:
          'Connect Notion under Settings â†’ Connections and create a CRM database. Copy the database ID into the notionDatabaseId input.',
      },
      {
        type: 'slack',
        label: 'Slack Connection',
        description:
          'Connect Slack under Settings â†’ Connections for sales team notifications.',
      },
      {
        type: 'model_key',
        label: 'Anthropic API Key',
        description:
          'Required by the AI qualifier and evaluator nodes under Settings â†’ Model Keys.',
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
              { name: 'leadUrl', type: 'string', required: true },
              { name: 'crmToken', type: 'string', required: true },
              { name: 'notionDatabaseId', type: 'string', required: true },
              { name: 'salesChannel', type: 'string', required: true },
              { name: 'rejectWebhook', type: 'string', required: true },
            ],
            testInput: {
              leadUrl: 'https://api.example.com/leads/123',
              crmToken: 'your-crm-token',
              notionDatabaseId: 'your-notion-db-id',
              salesChannel: '#sales',
              rejectWebhook: 'https://example.com/reject',
            },
          },
          position: { x: 100, y: 250 },
        },
        {
          id: 'fetch',
          type: 'http',
          data: {
            nodeType: 'http',
            label: 'Get Lead',
            method: 'GET',
            url: '{{input.leadUrl}}',
            headers: { Authorization: 'Bearer {{input.crmToken}}' },
          },
          position: { x: 320, y: 250 },
        },
        {
          id: 'extract',
          type: 'extract',
          data: {
            nodeType: 'extract',
            label: 'Extract Fields',
            fields: [
              { name: 'name', path: '$.lead.name' },
              { name: 'company', path: '$.lead.company' },
              { name: 'role', path: '$.lead.title' },
              { name: 'email', path: '$.lead.email' },
            ],
          },
          position: { x: 540, y: 250 },
        },
        {
          id: 'qualify',
          type: 'agent',
          data: {
            nodeType: 'agent',
            label: 'Qualify Lead',
            model: 'claude-sonnet-4-6',
            systemPrompt:
              'You qualify B2B SaaS leads. Evaluate fit based on company size, role seniority, and likely budget. Reply with JSON: {"fit":"high|medium|low","reasoning":"<2 sentences>","estimatedBudget":"<range>"}',
            userPrompt:
              'Lead: {{extract.name}} â€” {{extract.role}} at {{extract.company}}',
            outputSchema:
              '{"type":"object","properties":{"fit":{"type":"string"},"reasoning":{"type":"string"},"estimatedBudget":{"type":"string"}},"required":["fit","reasoning"]}',
          },
          position: { x: 760, y: 250 },
        },
        {
          id: 'eval',
          type: 'evaluator',
          data: {
            nodeType: 'evaluator',
            label: 'Score Quality',
            criteria:
              'Score the lead qualification response on whether it provides actionable insight: clear fit rating, specific reasoning, and a budget estimate. Penalise vague or generic responses.',
            input: '{{qualify}}',
            scoreMin: 0,
            scoreMax: 10,
            passThreshold: 0.6,
          },
          position: { x: 980, y: 250 },
        },
        {
          id: 'route',
          type: 'if-else',
          data: {
            nodeType: 'if-else',
            label: 'High Quality?',
            condition: 'variables.eval.passed == true',
          },
          position: { x: 1200, y: 250 },
        },
        {
          id: 'notion',
          type: 'notion',
          data: {
            nodeType: 'notion',
            label: 'Add to Notion CRM',
            action: 'create_page',
            databaseId: '{{input.notionDatabaseId}}',
            properties: {
              Name: { title: [{ text: { content: '{{extract.name}}' } }] },
              Company: {
                rich_text: [{ text: { content: '{{extract.company}}' } }],
              },
              Role: { rich_text: [{ text: { content: '{{extract.role}}' } }] },
              Fit: { select: { name: '{{qualify.fit}}' } },
              Score: { number: '{{eval.score}}' },
            },
          },
          position: { x: 1420, y: 100 },
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
              'ðŸŽ¯ *New qualified lead!*\n*{{extract.name}}* â€” {{extract.role}} @ {{extract.company}}\nFit: {{qualify.fit}} | Score: {{eval.score}}/10\n_{{qualify.reasoning}}_',
          },
          position: { x: 1640, y: 100 },
        },
        {
          id: 'reject',
          type: 'http',
          data: {
            nodeType: 'http',
            label: 'Mark Rejected',
            method: 'POST',
            url: '{{input.rejectWebhook}}',
            body: '{"leadEmail":"{{extract.email}}","reason":"{{qualify.reasoning}}"}',
          },
          position: { x: 1420, y: 400 },
        },
        {
          id: 'end',
          type: 'end',
          data: { nodeType: 'end', label: 'End' },
          position: { x: 1860, y: 250 },
        },
      ],
      edges: [
        { id: 'e1', source: 'start', target: 'fetch' },
        { id: 'e2', source: 'fetch', target: 'extract' },
        { id: 'e3', source: 'extract', target: 'qualify' },
        { id: 'e4', source: 'qualify', target: 'eval' },
        { id: 'e5', source: 'eval', target: 'route' },
        { id: 'e6', source: 'route', target: 'notion', sourceHandle: 'true' },
        { id: 'e7', source: 'notion', target: 'slack' },
        { id: 'e8', source: 'route', target: 'reject', sourceHandle: 'false' },
        { id: 'e9', source: 'slack', target: 'end' },
        { id: 'e10', source: 'reject', target: 'end' },
      ],
    },
  },

  {
    name: 'Content Safety Moderator',
    description:
      'Run user-submitted content through all safety guardrails (PII, moderation, jailbreak), have AI explain any violations, then route to human approval before final action.',
    category: 'Safety',
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
              { name: 'platform', type: 'string', required: true },
              { name: 'contentId', type: 'string', required: true },
              { name: 'moderationWebhook', type: 'string', required: true },
            ],
            testInput: {
              platform: 'twitter',
              contentId: 'post-123',
              moderationWebhook: 'https://example.com/moderation',
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
              { key: 'platform', value: '{{input.platform}}' },
              { key: 'contentId', value: '{{input.contentId}}' },
            ],
          },
          position: { x: 320, y: 250 },
        },
        {
          id: 'guard',
          type: 'guardrails',
          data: {
            nodeType: 'guardrails',
            label: 'Run All Checks',
            checks: ['pii', 'moderation', 'jailbreak'],
            action: 'redact',
            inputKey: 'input',
          },
          position: { x: 540, y: 250 },
        },
        {
          id: 'explain',
          type: 'agent',
          data: {
            nodeType: 'agent',
            label: 'Explain Violations',
            model: 'claude-sonnet-4-6',
            systemPrompt:
              'You are a content moderation assistant. Explain clearly what policy violations were detected and why the content may need to be removed.',
            userPrompt:
              'Content submitted:\n{{input.message}}\n\nGuardrail result:\n{{guard}}\n\nExplain the violations found and recommend an action (approve / redact / remove).',
          },
          position: { x: 760, y: 250 },
        },
        {
          id: 'approval',
          type: 'approval',
          data: {
            nodeType: 'approval',
            label: 'Human Review',
            message:
              'Content moderation review required.\n\nContent ID: {{vars.contentId}}\nPlatform: {{vars.platform}}\n\nAI Assessment:\n{{explain}}',
          },
          position: { x: 980, y: 250 },
        },
        {
          id: 'action',
          type: 'http',
          data: {
            nodeType: 'http',
            label: 'Apply Decision',
            method: 'POST',
            url: '{{input.moderationWebhook}}',
            body: '{"contentId":"{{vars.contentId}}","decision":"approved","redactedText":"{{guard.redactedText}}","reasoning":"{{explain}}"}',
          },
          position: { x: 1200, y: 250 },
        },
        {
          id: 'end',
          type: 'end',
          data: { nodeType: 'end', label: 'End' },
          position: { x: 1420, y: 250 },
        },
      ],
      edges: [
        { id: 'e1', source: 'start', target: 'vars' },
        { id: 'e2', source: 'vars', target: 'guard' },
        { id: 'e3', source: 'guard', target: 'explain' },
        { id: 'e4', source: 'explain', target: 'approval' },
        { id: 'e5', source: 'approval', target: 'action' },
        { id: 'e6', source: 'action', target: 'end' },
      ],
    },
  },
];
