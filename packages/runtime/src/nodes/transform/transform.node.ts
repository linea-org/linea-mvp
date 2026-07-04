import { NodeExecutor, NodeRequest, WorkflowNodeType } from "../node"
import { TransformNodeConfig, TransformResult } from "./transform.types"

export class TransformNode implements NodeExecutor<"transform"> {
  readonly type = "transform"

  async execute(
    request: NodeRequest<TransformNodeConfig>
  ): Promise<TransformResult> {
    const values: Record<string, string> = {}

    for (const [key, template] of Object.entries(request.config.values)) {
      values[key] = this.render(template, request.config.variables)
    }

    return { values }
  }

  private render(template: string, variables: Record<string, unknown>): string {
    return template.replace(/\{\{(.*?)\}\}/g, (_, key) => {
      const value = variables[key.trim()]

      return value == null ? "" : String(value)
    })
  }
}
