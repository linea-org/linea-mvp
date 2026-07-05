import { AIProviderType } from "../../schemas/providers.schema.js"
import { ChatMessage, ToolDefinition } from "@linea/types"

export type VariableMap = Record<string, unknown>

export interface TransformNodeConfig {
  variables: VariableMap
}

export interface HttpNodeConfig {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  url: string
  headers: Record<string, string>
  body?: unknown
}

export interface AgentNodeConfig {
  provider: AIProviderType
  model: string

  systemPrompt?: string

  temperature?: number
  maxTokens?: number

  messages: ChatMessage[]
  tools: ToolDefinition[]
}

export interface WorkflowNodeMap {
  agent: AgentNodeConfig
  transform: TransformNodeConfig
  http: HttpNodeConfig
}
