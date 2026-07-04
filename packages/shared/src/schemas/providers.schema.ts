import z from "zod"

export const INTEGRATION_PROVIDERS = ["github", "slack", "notion"] as const
export type IntegrationType = (typeof INTEGRATION_PROVIDERS)[number]

export const integrationConfigSchemas = {
  slack: z.object({
    accessToken: z.string().min(1),
    scope: z.string().optional(),
  }),
  github: z.object({ token: z.string().min(1) }),
  notion: z.object({ token: z.string().min(1) }),
} satisfies Record<IntegrationType, z.ZodTypeAny>

export type IntegrationConfigMap = {
  [K in IntegrationType]: z.infer<(typeof integrationConfigSchemas)[K]>
}

export const AI_PROVIDERS = [
  "anthropic",
  "openai",
  "groq",
  "google",
  "ollama",
  "xai",
] as const

export type AIProviderType = (typeof AI_PROVIDERS)[number]

export const aiConfigSchemas = {
  openai: z.object({ apiKey: z.string().min(1) }),
  anthropic: z.object({ apiKey: z.string().min(1) }),
  groq: z.object({ apiKey: z.string().min(1) }),
  google: z.object({ apiKey: z.string().min(1) }),
  xai: z.object({ apiKey: z.string().min(1) }),
  ollama: z.object({ host: z.url() }),
} satisfies Record<AIProviderType, z.ZodTypeAny>

export type AIProviderConfigMap = {
  [K in AIProviderType]: z.infer<(typeof aiConfigSchemas)[K]>
}
