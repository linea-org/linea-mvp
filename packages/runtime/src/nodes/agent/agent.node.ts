import { AIClient } from "@linea/ai"
import { CompletionResult } from "@linea/types"
import { NodeExecutor, NodeRequest } from "../node"
import { AgentNodeConfig } from "./agent.types"

export class AgentNode implements NodeExecutor<"agent"> {
  constructor(private readonly ai: AIClient) {}

  readonly type = "agent"

  async execute(
    request: NodeRequest<AgentNodeConfig>
  ): Promise<CompletionResult> {
    const client = await this.ai.getClient(
      request.config.provider,
      request.workspaceId
    )

    return client.chat(request.config.model, {
      system: request.config.systemPrompt,
      messages: request.config.messages,
      tools: request.config.tools,
      temperature: request.config.temperature,
      maxTokens: request.config.maxTokens,
    })
  }
}
