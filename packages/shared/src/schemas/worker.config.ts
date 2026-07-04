import { z } from "zod"

export const workerConfigSchema = z.object({
  NODE_ENV: z
    .enum(["development", "staging", "production"])
    .default("development"),

  DATABASE_URL: z.url(),
  REDIS_URL: z.url().optional(),

  // generate via openssl rand -base64 32
  ENCRYPTION_KEY_1: z
    .string()
    .length(44, "Must be a base64-encoded 32-byte key (44 chars)"),

  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
})

export type WorkerConfig = z.infer<typeof workerConfigSchema>
