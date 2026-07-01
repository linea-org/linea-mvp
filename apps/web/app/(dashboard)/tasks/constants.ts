import {
  Add01Icon, CloudUploadIcon, Calendar01Icon, Search01Icon, WorkflowSquare01Icon,
  LinkSquare01Icon, FlowIcon, FlowCircleIcon, AiBrain01Icon, Settings01Icon, ArrowDown01Icon,
  HelpCircleIcon, MailSend01Icon, ReloadIcon, SourceCodeSquareIcon, UserGroupIcon,
  Message01Icon, StickyNote01Icon,
} from '@hugeicons/core-free-icons';
import type { ModelOption } from './types';

export const API_BASE = `${process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'}/v1`;

export const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Anthropic', openai: 'OpenAI', xai: 'xAI (Grok)',
  groq: 'Groq', google: 'Google', ollama: 'Ollama (Local)',
};

export const MODEL_LIST: ModelOption[] = [
  { id: 'claude-sonnet-4-6',              label: 'Claude Sonnet 4.6',     hint: 'Balanced',    provider: 'anthropic', badge: 'best-for-agents' },
  { id: 'claude-opus-4-7',               label: 'Claude Opus 4.7',       hint: 'Powerful',    provider: 'anthropic', badge: 'most-capable'   },
  { id: 'claude-haiku-4-5',              label: 'Claude Haiku 4.5',      hint: 'Fast',        provider: 'anthropic'                          },
  { id: 'claude-3-5-sonnet-20241022',    label: 'Claude 3.5 Sonnet',     hint: 'Legacy',      provider: 'anthropic'                          },
  { id: 'gpt-4o',                        label: 'GPT-4o',                hint: 'Balanced',    provider: 'openai',    badge: 'recommended'    },
  { id: 'gpt-4o-mini',                   label: 'GPT-4o Mini',           hint: 'Fast',        provider: 'openai',    badge: 'best-value'     },
  { id: 'gpt-4.1',                       label: 'GPT-4.1',               hint: 'Long ctx',    provider: 'openai'                             },
  { id: 'o4-mini',                       label: 'o4 Mini',               hint: 'Reasoning',   provider: 'openai',    badge: 'best-reasoning' },
  { id: 'o3',                            label: 'o3',                    hint: 'Reasoning',   provider: 'openai'                             },
  { id: 'grok-3',                        label: 'Grok 3',                hint: 'Powerful',    provider: 'xai',       badge: 'recommended'    },
  { id: 'grok-3-mini',                   label: 'Grok 3 Mini',           hint: 'Reasoning',   provider: 'xai',       badge: 'best-value'     },
  { id: 'grok-2-1212',                   label: 'Grok 2',                hint: 'Balanced',    provider: 'xai'                                },
  { id: 'grok-2-vision-1212',            label: 'Grok 2 Vision',         hint: 'Vision',      provider: 'xai'                                },
  { id: 'llama-3.3-70b-versatile',       label: 'Llama 3.3 70B',         hint: 'Fast',        provider: 'groq',      badge: 'recommended'    },
  { id: 'llama-3.1-8b-instant',          label: 'Llama 3.1 8B',          hint: 'Fastest',     provider: 'groq',      badge: 'fastest'        },
  { id: 'deepseek-r1-distill-llama-70b', label: 'DeepSeek R1 70B',       hint: 'Reasoning',   provider: 'groq',      badge: 'best-reasoning' },
  { id: 'qwen-qwq-32b',                  label: 'Qwen QwQ 32B',          hint: 'Reasoning',   provider: 'groq'                               },
  { id: 'mixtral-8x7b-32768',            label: 'Mixtral 8x7B',          hint: 'Balanced',    provider: 'groq'                               },
  { id: 'gemini-2.5-pro-preview-05-06',  label: 'Gemini 2.5 Pro',        hint: 'Powerful',    provider: 'google',    badge: 'most-capable'   },
  { id: 'gemini-2.0-flash',              label: 'Gemini 2.0 Flash',      hint: 'Fast',        provider: 'google',    badge: 'recommended'    },
  { id: 'gemini-2.0-flash-lite',         label: 'Gemini 2.0 Flash Lite', hint: 'Cheapest',    provider: 'google',    badge: 'best-value'     },
  { id: 'llama3.2',                      label: 'Llama 3.2',             hint: 'Local',       provider: 'ollama'                             },
  { id: 'qwen2.5',                       label: 'Qwen 2.5',              hint: 'Local',       provider: 'ollama',    badge: 'recommended'    },
  { id: 'deepseek-r1',                   label: 'DeepSeek R1',           hint: 'Local',       provider: 'ollama'                             },
  { id: 'mistral',                       label: 'Mistral 7B',            hint: 'Local',       provider: 'ollama'                             },
];

export const MODEL_PROVIDERS = Array.from(new Set(MODEL_LIST.map((m) => m.provider)));
export const MODELS_BY_PROVIDER = Object.fromEntries(
  MODEL_PROVIDERS.map((p) => [p, MODEL_LIST.filter((m) => m.provider === p)]),
);

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
