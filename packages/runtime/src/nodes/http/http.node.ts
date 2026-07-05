import type { HttpNodeConfig } from "@linea/shared/contracts"
import type { NodeContext, NodeExecutor, NodeResult } from "../node.js"

export class HttpNode implements NodeExecutor<"http"> {
  readonly type = "http"

  async execute(request: NodeContext<HttpNodeConfig>): Promise<NodeResult> {
    const response = await fetch(request.config.url, {
      method: request.config.method,
      headers: request.config.headers,
      body:
        request.config.body == null
          ? undefined
          : JSON.stringify(request.config.body),
    })

    return {
      variables: {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body: await response.json(),
      },
    }
  }
}
