import { AgentNode } from "./agent-node"
import { HttpNode } from "./http-node"
import { TransformNode } from "./transform-node"
import { StartNode } from "./start-node"
import { EndNode } from "./end-node"


export const nodeTypes = {
  start: StartNode,
  end: EndNode,
  agent: AgentNode,
  http: HttpNode,
  transform: TransformNode,

} as const
