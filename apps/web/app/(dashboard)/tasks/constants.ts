import {
  Add01Icon, CloudUploadIcon, Calendar01Icon, Search01Icon, WorkflowSquare01Icon,
  LinkSquare01Icon, FlowIcon, FlowCircleIcon, AiBrain01Icon, Settings01Icon, ArrowDown01Icon,
  HelpCircleIcon, MailSend01Icon, ReloadIcon, SourceCodeSquareIcon, UserGroupIcon,
  Message01Icon, StickyNote01Icon,
} from '@hugeicons/core-free-icons';
export { API_BASE } from '@/lib/api';

export const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Anthropic', openai: 'OpenAI', xai: 'xAI (Grok)',
  groq: 'Groq', google: 'Google', ollama: 'Ollama (Local)',
};

// The default model used before the /models catalog has loaded.
export const DEFAULT_MODEL_ID = 'claude-sonnet-4-6';

export const TOOL_LABELS: Record<string, string> = {
  check_workspace_secrets: 'Check workspace secrets',
  list_pods:               'List pods',
  list_workflows:          'List workflows',
  create_workflow:         'Create workflow',
  run_workflow:            'Run workflow',
  schedule_workflow:       'Schedule workflow',
  deploy_workflow:         'Deploy workflow',
  search_knowledge:        'Search knowledge base',
};

export const SLASH_COMMANDS = [
  { cmd: '/run',       icon: FlowCircleIcon,      description: 'Run a workflow',                 template: 'Run the workflow '                          },
  { cmd: '/create',    icon: Add01Icon,            description: 'Create a new workflow',          template: 'Create a workflow that '                    },
  { cmd: '/deploy',    icon: CloudUploadIcon,      description: 'Deploy a workflow',              template: 'Deploy the workflow named '                 },
  { cmd: '/schedule',  icon: Calendar01Icon,       description: 'Schedule a workflow',            template: 'Schedule the workflow to run every '        },
  { cmd: '/search',    icon: Search01Icon,         description: 'Search the knowledge base',      template: 'Search for '                                },
  { cmd: '/list',      icon: WorkflowSquare01Icon, description: 'List all workflows',             template: 'List all workflows in this pod'             },
  { cmd: '/connect',   icon: LinkSquare01Icon,     description: 'Check external connectors',      template: 'Show me my connected external integrations' },
  { cmd: '/status',    icon: FlowIcon,             description: 'Check execution status',         template: 'What is the status of recent executions?'  },
  { cmd: '/memory',    icon: AiBrain01Icon,        description: 'Access memory & knowledge',      template: 'What do you know about '                   },
  { cmd: '/debug',     icon: Settings01Icon,       description: 'Debug a failed execution',       template: 'Why did my last execution fail?'            },
  { cmd: '/summarize', icon: ArrowDown01Icon,      description: 'Summarize recent activity',      template: 'Summarize what happened in this pod today' },
  { cmd: '/help',      icon: HelpCircleIcon,       description: 'Show all available commands',    template: 'What can you help me with?'                },
];

export const PRESETS = [
  { icon: MailSend01Icon,       label: 'Gmail to Slack',       prompt: 'Build a workflow that monitors my Gmail for important emails and posts them to a Slack channel' },
  { icon: ReloadIcon,           label: 'Daily sync & report',  prompt: 'Create a workflow that runs every morning to sync data and send me a summary report' },
  { icon: SourceCodeSquareIcon, label: 'GitHub issue tracker', prompt: 'Set up automated GitHub issue tracking with Slack notifications when issues are opened or assigned' },
  { icon: Search01Icon,         label: 'Check integrations',   prompt: 'Check what API keys and integrations I have configured in this workspace' },
  { icon: UserGroupIcon,        label: 'CRM automation',       prompt: 'Build a self-healing CRM that syncs and enriches customer data from my connected tools' },
  { icon: Calendar01Icon,       label: 'Morning briefing',     prompt: 'Create a workflow that sends me a daily morning briefing at 9am with key updates' },
];

export const TICKER_PROMPTS = [
  'Ask anything, or type / for commands…',
  '/run — trigger a workflow instantly…',
  '/create — build a new automation…',
  '/schedule — set up a recurring job…',
  '/search — query your knowledge base…',
  '/connect — check external integrations…',
];

export const CONNECTOR_TYPES = [
  { id: 'slack',  label: 'Slack',  icon: Message01Icon        },
  { id: 'github', label: 'GitHub', icon: SourceCodeSquareIcon },
  { id: 'gmail',  label: 'Gmail',  icon: MailSend01Icon       },
  { id: 'notion', label: 'Notion', icon: StickyNote01Icon     },
];
