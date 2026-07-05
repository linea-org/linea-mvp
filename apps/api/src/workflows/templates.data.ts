// Auto-extracted from templates.seeder.ts — source of truth for built-in templates
import type { TemplateDefinition } from './templates-data/types.js';
import { PRODUCTIVITY_TEMPLATES } from './templates-data/productivity-templates.js';
import { CONTENT_TEMPLATES } from './templates-data/content-templates.js';
import { AI_OPS_TEMPLATES } from './templates-data/ai-ops-templates.js';
import { INTEGRATION_TEMPLATES } from './templates-data/integration-templates.js';

export const BUILT_IN_TEMPLATES: TemplateDefinition[] = [
  ...PRODUCTIVITY_TEMPLATES,
  ...CONTENT_TEMPLATES,
  ...AI_OPS_TEMPLATES,
  ...INTEGRATION_TEMPLATES,
];
