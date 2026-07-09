import type { TransformNodeConfig, VariableMap } from "@linea/shared/contracts"

import type { NodeContext, NodeExecutor, NodeResult } from "../node.js"

export class TransformNode implements NodeExecutor<"transform"> {
  readonly type = "transform"

  async execute(
    context: NodeContext<TransformNodeConfig>
  ): Promise<NodeResult> {
    const output: VariableMap = {}

    for (const [key, value] of Object.entries(context.config.variables)) {
      if (typeof value === "string") {
        output[key] = context.template.render(value, {
          variables: {
            ...context.state.variables,
            ...output,
          },
          nodeResults: context.state.nodeResults,
        })
      } else {
        output[key] = value
      }
    }

    return {
      variables: output,
      nodeResults: {
        [context.node.id]: output,
      },
    }
  }
}
