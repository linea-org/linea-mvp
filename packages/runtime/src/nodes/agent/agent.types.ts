import { AIProviderType } from "@linea/shared"
import { ChatMessage, ToolDefinition } from "@linea/types"

export interface AgentNodeConfig {
  provider: AIProviderType
  model: string

  systemPrompt?: string

  temperature?: number
  maxTokens?: number

  messages: ChatMessage[]
  tools: ToolDefinition[]
}
