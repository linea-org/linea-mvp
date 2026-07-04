import {
  AIProviderConfigMap,
  aiConfigSchemas,
  AIProviderType,
  IntegrationConfigMap,
  integrationConfigSchemas,
  IntegrationType,
} from "./schemas/providers.schema"

type ProviderType = AIProviderType | IntegrationType

type ProviderConfigMap = AIProviderConfigMap & IntegrationConfigMap

const providerConfigSchemas = {
  ...aiConfigSchemas,
  ...integrationConfigSchemas,
} satisfies {
  [K in ProviderType]: {
    parse(data: unknown): ProviderConfigMap[K]
  }
}

export function parseProviderConfig<T extends ProviderType>(
  type: T,
  decryptedJson: string
): ProviderConfigMap[T] {
  const schema = providerConfigSchemas[type]
  const parsed = JSON.parse(decryptedJson)

  return schema.parse(parsed) as ProviderConfigMap[T]
}
