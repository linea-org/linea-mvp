import { z } from 'zod';

export const configSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'staging', 'production'])
    .default('development'),
  PORT: z.coerce.number().default(3001),

  DATABASE_URL: z.string().url(),

  REDIS_URL: z.string().url().optional(),

  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CLERK_WEBHOOK_SECRET: z.string().min(1),

  // generate via openssl rand -base64 32
  ENCRYPTION_KEY_1: z
    .string()
    .length(44, 'Must be a base64-encoded 32-byte key (44 chars)'),

  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),

  // Default model IDs (override per-node, fallback to these)
  DEFAULT_AGENT_MODEL: z.string().default('claude-sonnet-4-6'),
  SUPERVISOR_MODEL: z.string().default('claude-haiku-4-5'),
});
