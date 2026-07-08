import type { HttpNodeConfig } from "@linea/shared/contracts"

import type { NodeContext, NodeExecutor, NodeResult } from "../node.js"

export class HttpNode implements NodeExecutor<"http"> {
  readonly type = "http"

  async execute(context: NodeContext<HttpNodeConfig>): Promise<NodeResult> {
    const response = await fetch(context.config.url, {
      method: context.config.method,
      headers: context.config.headers,
      body:
        context.config.body == null
          ? undefined
          : JSON.stringify(context.config.body),
    })

    const body = await response.json()

    const output = {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body,
    }

    return {
      variables: output,
      nodeResults: {
        [context.node.id]: output,
      },
    }
  }
}
