import { ModelClient } from "./clients/interface"
import { OpenAIClient } from "./clients/openai.client"
import { AnthropicClient } from "./clients/anthropic.client"
import { OllamaClient } from "./clients/ollama.client"
import { XAIClient } from "./clients/xai.client"
import { GoogleClient } from "./clients/google.client"
import { GroqClient } from "./clients/groq.client"
import {
  AIProviderConfigMap,
  AIProviderType,
  decryptConfig,
  parseProviderConfig,
} from "@linea/shared"
import type { AIOptions, EncryptionKeys } from "./types"
import { Database } from "@linea/db"

export class AIClient {
  private readonly systemConfig: AIProviderConfigMap
  private readonly encryptionKeys: EncryptionKeys

  constructor(
    options: AIOptions,

    private readonly db: Database
  ) {
    this.systemConfig = {
      anthropic: {
        apiKey: options.anthropicApiKey ?? "",
      },
      google: {
        apiKey: options.googleApiKey ?? "",
      },
      groq: {
        apiKey: options.groqApiKey ?? "",
      },
      ollama: {
        host: "http://localhost:1431/v1",
      },
      openai: {
        apiKey: options.openaiApiKey ?? "",
      },
      xai: {
        apiKey: options.xaiApiKey ?? "",
      },
    }

    this.encryptionKeys = options.encryption.keys
  }

  async getClient(
    provider: AIProviderType,
    workspaceId?: string
  ): Promise<ModelClient> {
    const config = workspaceId
      ? await this.getConfig(workspaceId, provider)
      : this.systemConfig[provider]

    return this.createClient(provider, config)
  }

  private createClient<T extends AIProviderType>(
    provider: T,
    config: AIProviderConfigMap[T]
  ): ModelClient {
    switch (provider) {
      case "openai": {
        const c = config as AIProviderConfigMap["openai"]
        if (!c.apiKey) {
          throw new Error("OpenAI API key is required.")
        }
        return new OpenAIClient(c.apiKey)
      }

      case "anthropic": {
        const c = config as AIProviderConfigMap["anthropic"]
        if (!c.apiKey) {
          throw new Error("Anthropic API key is required.")
        }
        return new AnthropicClient(c.apiKey)
      }

      case "ollama": {
        const c = config as AIProviderConfigMap["ollama"]
        return new OllamaClient("ollama", c.host)
      }
      case "google": {
        const c = config as AIProviderConfigMap["google"]
        if (!c.apiKey) {
          throw new Error("Google Gemini API key is required.")
        }
        return new GoogleClient(c.apiKey)
      }
      case "groq": {
        const c = config as AIProviderConfigMap["groq"]
        if (!c.apiKey) {
          throw new Error("Groq API key is required.")
        }
        return new GroqClient(c.apiKey)
      }
      case "xai": {
        const c = config as AIProviderConfigMap["xai"]
        if (!c.apiKey) {
          throw new Error("xAI API key is required.")
        }
        return new XAIClient(c.apiKey)
      }
      default: {
        const exhaustive: never = provider
        throw new Error(`Unsupported provider: ${exhaustive}`)
      }
    }
  }

  private async getWorkspaceConfig<T extends AIProviderType>(
    workspaceId: string,
    provider: T
  ): Promise<AIProviderConfigMap[T] | null> {
    const connection = await this.db.connection.findByProvider(
      workspaceId,
      provider
    )

    if (!connection) {
      return null
    }

    const key = this.encryptionKeys[connection.encryptionKeyVersion]

    if (!key) {
      throw new Error(
        `Encryption key not found for version ${connection.encryptionKeyVersion}`
      )
    }

    const decryptedConfig = decryptConfig(
      connection.configEncrypted,
      connection.encryptionIV,
      connection.encryptionAuthTag,
      key
    )

    return parseProviderConfig(provider, decryptedConfig)
  }

  private async getConfig<T extends AIProviderType>(
    workspaceId: string,
    provider: T
  ): Promise<AIProviderConfigMap[T]> {
    const config = await this.getWorkspaceConfig(workspaceId, provider)

    if (config) {
      return config
    }

    return this.systemConfig[provider]
  }
}
