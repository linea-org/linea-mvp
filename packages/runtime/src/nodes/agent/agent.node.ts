import { AIClient } from "@linea/ai"
import type { NodeContext, NodeExecutor, NodeResult } from "../node"
import type { AgentNodeConfig } from "./agent.types"

export class AgentNode implements NodeExecutor<"agent"> {
  constructor(private readonly ai: AIClient) {}

  readonly type = "agent"

  async execute(context: NodeContext<AgentNodeConfig>): Promise<NodeResult> {
    const client = await this.ai.getClient(
      context.config.provider,
      context.state.workflowId
    )

    const system = context.template.render(
      context.config.systemPrompt ?? "",
      context.state.variables
    )

    const messages = context.config.messages.map((m) => ({
      ...m,
      content: context.template.render(m.content, context.state.variables),
    }))

    const completion = await client.chat(context.config.model, {
      system: system,
      messages: messages,
      tools: context.config.tools,
      temperature: context.config.temperature,
      maxTokens: context.config.maxTokens,
    })

    return {
      variables: {
        text: completion.text,
        usage: completion.usage,
        finishReason: completion.stopReason,
        toolCalls: completion.toolCalls,
      },
    }
  }
}
