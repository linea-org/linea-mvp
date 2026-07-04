import { NodeExecutor, NodeRequest, WorkflowNodeType } from "../node"
import { HttpNodeConfig, HttpResult } from "./http.types"

export class HttpNode implements NodeExecutor<"http"> {
  readonly type = "http"

  async execute(request: NodeRequest<HttpNodeConfig>): Promise<HttpResult> {
    const response = await fetch(request.config.url, {
      method: request.config.method,
      headers: request.config.headers,
      body:
        request.config.body == null
          ? undefined
          : JSON.stringify(request.config.body),
    })

    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: await response.json(),
    }
  }
}
