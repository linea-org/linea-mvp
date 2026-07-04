import { CompletionResult } from "@linea/types"
import {
  TransformNodeConfig,
  TransformResult,
} from "./transform/transform.types"
import { HttpNodeConfig, HttpResult } from "./http/http.types"
import { NodeRequest } from "./node"
import { AgentNodeConfig } from "./agent/agent.types"

export interface NodeMap {
  agent: {
    request: NodeRequest<AgentNodeConfig>
    result: CompletionResult
  }
  transform: {
    request: NodeRequest<TransformNodeConfig>
    result: TransformResult
  }

  http: {
    request: NodeRequest<HttpNodeConfig>
    result: HttpResult
  }
}
