import { AIClient } from "@linea/ai"
import { NodeRegistry } from "./registry"
import { AgentNode } from "./nodes/agent/agent.node"
import { TransformNode } from "./nodes/transform/transform.node"
import { HttpNode } from "./nodes/http/http.node"
import { WorkflowNodeType } from "./nodes/node"
import { NodeMap } from "./nodes"

export class Runtime {
  private readonly registry: NodeRegistry

  constructor(ai: AIClient) {
    this.registry = new NodeRegistry([
      new AgentNode(ai),
      new TransformNode(),
      new HttpNode(),
    ])
  }

  get registryInstance() {
    return this.registry
  }

  async execute<T extends WorkflowNodeType>(
    type: T,
    request: NodeMap[T]["request"]
  ): Promise<NodeMap[T]["result"]> {
    return this.registry.get(type).execute(request)
  }
}
