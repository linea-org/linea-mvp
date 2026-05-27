import {
  Injectable,
  Inject,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { DrizzleDB } from '@linea/db';
import { templates } from '@linea/db';
import { DB_TOKEN } from '../database/database.module';

interface Prerequisite {
  type: string;
  label: string;
  description: string;
}

const BUILT_IN_TEMPLATES: Array<{
  name: string;
  description: string;
  category: string;
  featured: boolean;
  prerequisites?: Prerequisite[];
  definition: object;
}> = [
  // ─── Existing templates ───────────────────────────────────────────────────

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
          data: { nodeType: 'start', label: 'Start' },
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
        description: 'Connect your Slack workspace under Settings → Connections so the Slack node can post messages.',
      },
    ],
    definition: {
      nodes: [
        {
          id: 'start',
          type: 'start',
          data: { nodeType: 'start', label: 'Start' },
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
          data: { nodeType: 'start', label: 'Start' },
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
        description: 'Connect your GitHub account under Settings → Connections to allow the GitHub node to create issues.',
      },
      {
        type: 'model_key',
        label: 'Anthropic API Key',
        description: 'Add your Anthropic API key under Settings → Model Keys for AI-powered triage.',
      },
    ],
    definition: {
      nodes: [
        {
          id: 'start',
          type: 'start',
          data: { nodeType: 'start', label: 'Start' },
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
            userPrompt: '{{input.issueBody}}',
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
            body: '{{input.issueBody}}\n\n**Priority:** {{triage.priority}}',
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
          data: { nodeType: 'start', label: 'Start' },
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
            userPrompt: '{{input.request}}',
          },
          position: { x: 320, y: 200 },
        },
        {
          id: 'approval',
          type: 'approval-gate',
          data: {
            nodeType: 'approval-gate',
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

  // ─── New templates ────────────────────────────────────────────────────────

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
        description: 'Connect Slack under Settings → Connections so the digest can be posted to a channel.',
      },
      {
        type: 'model_key',
        label: 'Anthropic API Key',
        description: 'Required by the AI summarizer node under Settings → Model Keys.',
      },
    ],
    definition: {
      nodes: [
        {
          id: 'start',
          type: 'start',
          data: { nodeType: 'start', label: 'Start' },
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
            fields: [
              { name: 'articles', path: '$.articles' },
            ],
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
            itemTransform: 'item.title + " — " + item.description',
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
            message: '*📰 Article Digest*\n\n{{summarize}}',
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
        description: 'Create a Knowledge Base in the Knowledge section, upload your content, and copy its ID to use as the knowledgeBaseId input.',
      },
      {
        type: 'model_key',
        label: 'Anthropic API Key',
        description: 'Add your Anthropic API key under Settings → Model Keys so the AI agent and guardrails can run.',
      },
    ],
    definition: {
      nodes: [
        {
          id: 'start',
          type: 'start',
          data: { nodeType: 'start', label: 'Start' },
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
              { key: 'systemRole', value: 'You are a helpful assistant. Answer only based on the provided context.' },
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
            memoryQuery: '{{input.question}}',
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
            query: '{{input.question}}',
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
              'Prior conversation:\n{{history.memories}}\n\nRelevant knowledge:\n{{retriever}}\n\nQuestion: {{input.question}}',
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
            memoryValue: '{"q":"{{input.question}}","a":"{{answer}}"}',
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
        description: 'Connect your Google account under Settings → Connections so the Gmail node can send the report email.',
      },
      {
        type: 'model_key',
        label: 'Anthropic API Key',
        description: 'Required by the AI analysis node under Settings → Model Keys.',
      },
    ],
    definition: {
      nodes: [
        {
          id: 'start',
          type: 'start',
          data: { nodeType: 'start', label: 'Start' },
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
            subject: 'Competitive Analysis Report — {{input.url1}}',
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
        description: 'Connect Notion under Settings → Connections and create a CRM database. Copy the database ID into the notionDatabaseId input.',
      },
      {
        type: 'slack',
        label: 'Slack Connection',
        description: 'Connect Slack under Settings → Connections for sales team notifications.',
      },
      {
        type: 'model_key',
        label: 'Anthropic API Key',
        description: 'Required by the AI qualifier and evaluator nodes under Settings → Model Keys.',
      },
    ],
    definition: {
      nodes: [
        {
          id: 'start',
          type: 'start',
          data: { nodeType: 'start', label: 'Start' },
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
              { name: 'name',    path: '$.lead.name'    },
              { name: 'company', path: '$.lead.company' },
              { name: 'role',    path: '$.lead.title'   },
              { name: 'email',   path: '$.lead.email'   },
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
              'Lead: {{extract.name}} — {{extract.role}} at {{extract.company}}',
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
              Name:    { title:  [{ text: { content: '{{extract.name}}' } }] },
              Company: { rich_text: [{ text: { content: '{{extract.company}}' } }] },
              Role:    { rich_text: [{ text: { content: '{{extract.role}}' } }] },
              Fit:     { select: { name: '{{qualify.fit}}' } },
              Score:   { number: '{{eval.score}}' },
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
              '🎯 *New qualified lead!*\n*{{extract.name}}* — {{extract.role}} @ {{extract.company}}\nFit: {{qualify.fit}} | Score: {{eval.score}}/10\n_{{qualify.reasoning}}_',
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
        { id: 'e1', source: 'start',   target: 'fetch'   },
        { id: 'e2', source: 'fetch',   target: 'extract' },
        { id: 'e3', source: 'extract', target: 'qualify' },
        { id: 'e4', source: 'qualify', target: 'eval'    },
        { id: 'e5', source: 'eval',    target: 'route'   },
        { id: 'e6', source: 'route',   target: 'notion',  sourceHandle: 'true'  },
        { id: 'e7', source: 'notion',  target: 'slack'   },
        { id: 'e8', source: 'route',   target: 'reject',  sourceHandle: 'false' },
        { id: 'e9', source: 'slack',   target: 'end'     },
        { id: 'e10',source: 'reject',  target: 'end'     },
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
          data: { nodeType: 'start', label: 'Start' },
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
              'Content submitted:\n{{input.content}}\n\nGuardrail result:\n{{guard}}\n\nExplain the violations found and recommend an action (approve / redact / remove).',
          },
          position: { x: 760, y: 250 },
        },
        {
          id: 'approval',
          type: 'approval-gate',
          data: {
            nodeType: 'approval-gate',
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
            body:
              '{"contentId":"{{vars.contentId}}","decision":"approved","redactedText":"{{guard.redactedText}}","reasoning":"{{explain}}"}',
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
        { id: 'e1', source: 'start',    target: 'vars'     },
        { id: 'e2', source: 'vars',     target: 'guard'    },
        { id: 'e3', source: 'guard',    target: 'explain'  },
        { id: 'e4', source: 'explain',  target: 'approval' },
        { id: 'e5', source: 'approval', target: 'action'   },
        { id: 'e6', source: 'action',   target: 'end'      },
      ],
    },
  },

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
        description: 'Connect Slack under Settings → Connections for digest posting.',
      },
      {
        type: 'gmail',
        label: 'Gmail Connection',
        description: 'Connect Gmail under Settings → Connections for email delivery.',
      },
      {
        type: 'model_key',
        label: 'Anthropic API Key',
        description: 'Required by the AI digest writer under Settings → Model Keys.',
      },
    ],
    definition: {
      nodes: [
        {
          id: 'start',
          type: 'start',
          data: { nodeType: 'start', label: 'Start' },
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
              'Write a concise, executive-style metrics digest. Use emoji indicators (📈 up, 📉 down, ➡️ flat). Keep it under 200 words.',
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
            message: '*📊 Metrics Digest — {{ts.formatted}}*\n\n{{digest}}',
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
            subject: 'Metrics Digest — {{ts.formatted}}',
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
        { id: 'e1', source: 'start',   target: 'ts'     },
        { id: 'e2', source: 'ts',      target: 'recall' },
        { id: 'e3', source: 'recall',  target: 'metrics'},
        { id: 'e4', source: 'metrics', target: 'delta'  },
        { id: 'e5', source: 'delta',   target: 'digest' },
        { id: 'e6', source: 'digest',  target: 'save'   },
        { id: 'e7', source: 'save',    target: 'slack'  },
        { id: 'e8', source: 'save',    target: 'email'  },
        { id: 'e9', source: 'slack',   target: 'end'    },
        { id: 'e10',source: 'email',   target: 'end'    },
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
        description: 'Connect your GitHub account under Settings → Connections. The bot needs read access to PRs and write access to comments.',
      },
      {
        type: 'slack',
        label: 'Slack Connection',
        description: 'Connect Slack for team notifications when a review is posted.',
      },
      {
        type: 'model_key',
        label: 'Anthropic API Key',
        description: 'Required by the AI reviewer and evaluator nodes under Settings → Model Keys.',
      },
    ],
    definition: {
      nodes: [
        {
          id: 'start',
          type: 'start',
          data: { nodeType: 'start', label: 'Start' },
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
              { key: 'repo',  value: '{{input.repo}}'  },
              { key: 'pr',    value: '{{input.prNumber}}' },
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
              'Score this PR review on: (1) specificity — does it reference actual code rather than vague generalities? (2) actionability — are suggestions concrete and implementable? (3) completeness — does it cover security and correctness?',
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
            body: '## 🤖 Automated Code Review\n\n{{review}}\n\n---\n_Review quality score: {{eval.score}}/10_',
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
              '🔍 *PR Review Posted*\n<{{ghfetch.html_url}}|{{ghfetch.title}}> ({{vars.owner}}/{{vars.repo}} #{{vars.pr}})\nQuality score: {{eval.score}}/10',
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
        { id: 'e1', source: 'start',   target: 'vars'    },
        { id: 'e2', source: 'vars',    target: 'ghfetch' },
        { id: 'e3', source: 'ghfetch', target: 'guard'   },
        { id: 'e4', source: 'guard',   target: 'review'  },
        { id: 'e5', source: 'review',  target: 'eval'    },
        { id: 'e6', source: 'eval',    target: 'filter'  },
        { id: 'e7', source: 'filter',  target: 'comment' },
        { id: 'e8', source: 'comment', target: 'notify'  },
        { id: 'e9', source: 'notify',  target: 'end'     },
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
        description: 'Connect Notion under Settings → Connections. Create a database with columns: Name, Company, Role, Email, Stage, Source, Urgency, Use Case, Company Stage, Created, Owner. Copy the database ID.',
      },
      {
        type: 'slack',
        label: 'Slack Connection',
        description: 'Connect Slack for sales team alerts when a new lead arrives.',
      },
      {
        type: 'model_key',
        label: 'Anthropic API Key',
        description: 'Required by the AI enrichment node under Settings → Model Keys.',
      },
    ],
    definition: {
      nodes: [
        {
          id: 'start',
          type: 'start',
          data: { nodeType: 'start', label: 'Start' },
          position: { x: 100, y: 250 },
        },
        {
          id: 'extract',
          type: 'extract',
          data: {
            nodeType: 'extract',
            label: 'Extract Lead Fields',
            fields: [
              { name: 'name',    path: '$.name'    },
              { name: 'email',   path: '$.email'   },
              { name: 'company', path: '$.company' },
              { name: 'role',    path: '$.title'   },
              { name: 'source',  path: '$.source'  },
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
              { key: 'stage',    value: 'New'    },
              { key: 'priority', value: 'Medium' },
              { key: 'owner',    value: '{{input.defaultOwner}}' },
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
              Name:        { title: [{ text: { content: '{{extract.name}}' } }] },
              Company:     { rich_text: [{ text: { content: '{{extract.company}}' } }] },
              Role:        { rich_text: [{ text: { content: '{{extract.role}}' } }] },
              Email:       { email: '{{extract.email}}' },
              Stage:       { select: { name: '{{vars.stage}}' } },
              Source:      { select: { name: '{{extract.source}}' } },
              Urgency:     { select: { name: '{{enrich.urgency}}' } },
              'Use Case':  { rich_text: [{ text: { content: '{{enrich.useCase}}' } }] },
              'Company Stage': { select: { name: '{{enrich.companyStage}}' } },
              'Created':   { date: { start: '{{ts.formatted}}' } },
              Owner:       { rich_text: [{ text: { content: '{{vars.owner}}' } }] },
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
              '👤 *New Lead — {{extract.name}}*\n*{{extract.role}}* at *{{extract.company}}*\nSource: {{extract.source}} | Urgency: {{enrich.urgency}}\nUse case: {{enrich.useCase}}\n_{{enrich.notes}}_',
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
        { id: 'e1', source: 'start',   target: 'extract' },
        { id: 'e2', source: 'extract', target: 'vars'    },
        { id: 'e3', source: 'vars',    target: 'ts'      },
        { id: 'e4', source: 'ts',      target: 'guard'   },
        { id: 'e5', source: 'guard',   target: 'enrich'  },
        { id: 'e6', source: 'enrich',  target: 'notion'  },
        { id: 'e7', source: 'notion',  target: 'slack'   },
        { id: 'e8', source: 'slack',   target: 'end'     },
      ],
    },
  },
];

@Injectable()
export class TemplatesSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(TemplatesSeeder.name);

  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDB) {}

  async onApplicationBootstrap() {
    this.logger.log('Syncing built-in templates…');
    let inserted = 0;
    let updated = 0;

    for (const tpl of BUILT_IN_TEMPLATES) {
      const existing = await this.db
        .select({ id: templates.id })
        .from(templates)
        .where(eq(templates.name, tpl.name))
        .limit(1);

      if (existing.length > 0) {
        // Always sync source/prerequisites/featured/definition so that a
        // previously-inserted row that got the wrong source default is corrected.
        await this.db
          .update(templates)
          .set({
            source: 'internal',
            description: tpl.description,
            category: tpl.category,
            featured: tpl.featured,
            prerequisites: tpl.prerequisites ?? null,
            definition: tpl.definition as any,
          })
          .where(eq(templates.id, existing[0]!.id));
        updated++;
        continue;
      }

      await this.db.insert(templates).values({
        name: tpl.name,
        description: tpl.description,
        category: tpl.category,
        featured: tpl.featured,
        source: 'internal',
        prerequisites: tpl.prerequisites ?? null,
        definition: tpl.definition as any,
        downloads: 0,
      });

      inserted++;
    }

    if (inserted > 0 || updated > 0) {
      this.logger.log(`Built-in templates: ${inserted} inserted, ${updated} updated`);
    }
  }
}
