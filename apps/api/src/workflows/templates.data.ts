// Auto-extracted from templates.seeder.ts — source of truth for built-in templates
import type { TemplateDefinition } from './templates-data/types';
import { PRODUCTIVITY_TEMPLATES } from './templates-data/productivity-templates';
import { CONTENT_TEMPLATES } from './templates-data/content-templates';
import { AI_OPS_TEMPLATES } from './templates-data/ai-ops-templates';
import { INTEGRATION_TEMPLATES } from './templates-data/integration-templates';

export type { Prerequisite } from './templates-data/types';

export const BUILT_IN_TEMPLATES: TemplateDefinition[] = [
  ...PRODUCTIVITY_TEMPLATES,
  ...CONTENT_TEMPLATES,
  ...AI_OPS_TEMPLATES,
  ...INTEGRATION_TEMPLATES,
];

