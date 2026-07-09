import { AIClient } from "@linea/ai"
import type { AgentNodeConfig } from "@linea/shared/contracts"

import type { NodeContext, NodeExecutor, NodeResult } from "../node.js"

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

    const messages = context.config.messages.map((message) => ({
      ...message,
      content: context.template.render(
        message.content,
        context.state.variables
      ),
    }))

    const completion = await client.chat(context.config.model, {
      system,
      messages,
      tools: context.config.tools,
      temperature: context.config.temperature,
      maxTokens: context.config.maxTokens,
    })

    const output = {
      text: completion.text,
      usage: completion.usage,
      finishReason: completion.stopReason,
      toolCalls: completion.toolCalls,
    }

    return {
      variables: output,
      nodeResults: {
        [context.node.id]: output,
      },
    }
  }
}
