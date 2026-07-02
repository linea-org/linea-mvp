import z from 'zod';

export const providerConfigSchemas = {
  openai: z.object({ apiKey: z.string().min(1) }),
  anthropic: z.object({ apiKey: z.string().min(1) }),
  groq: z.object({ apiKey: z.string().min(1) }),
  google: z.object({ apiKey: z.string().min(1) }),
  xai: z.object({ apiKey: z.string().min(1) }),
  ollama: z.object({ host: z.string().url() }),
  slack: z.object({
    accessToken: z.string().min(1),
    scope: z.string().optional(),
  }),
  github: z.object({ token: z.string().min(1) }),
  notion: z.object({ token: z.string().min(1) }),
} satisfies Record<string, z.ZodTypeAny>;

export type ProviderType = keyof typeof providerConfigSchemas;
export const PROVIDERS = Object.keys(providerConfigSchemas) as ProviderType[];

export type ProviderConfigMap = {
  [K in ProviderType]: z.infer<(typeof providerConfigSchemas)[K]>;
};

export type AIProviderType = Extract<
  ProviderType,
  'anthropic' | 'openai' | 'groq' | 'google' | 'ollama' | 'xai'
>;

export type AIProviderConfigMap = {
  [K in AIProviderType]: z.infer<(typeof providerConfigSchemas)[K]>;
};

export function parseProviderConfig<T extends ProviderType>(
  type: T,
  decryptedJson: string,
): ProviderConfigMap[T] {
  const schema = providerConfigSchemas[type];
  const parsed = JSON.parse(decryptedJson);

  return schema.parse(parsed) as ProviderConfigMap[T];
}
