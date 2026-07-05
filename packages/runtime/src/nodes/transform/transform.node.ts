import type { TransformNodeConfig, VariableMap } from "@linea/shared/contracts"
import type { NodeContext, NodeExecutor, NodeResult } from "../node.js"

export class TransformNode implements NodeExecutor<"transform"> {
  readonly type = "transform"

  async execute(
    context: NodeContext<TransformNodeConfig>
  ): Promise<NodeResult> {
    const variables: VariableMap = {}

    for (const [key, value] of Object.entries(context.config.variables)) {
      if (typeof value === "string") {
        variables[key] = context.template.render(value, {
          ...context.state.variables,
          ...variables,
        })
      } else {
        variables[key] = value
      }
    }

    return {
      variables,
    }
  }
}
