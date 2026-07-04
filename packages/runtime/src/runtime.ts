import { AIClient } from "@linea/ai"
import { NodeRegistry } from "./registry"
import { AgentNode } from "./nodes/agent/agent.node"
import { TransformNode } from "./nodes/transform/transform.node"
import { HttpNode } from "./nodes/http/http.node"
import type { WorkflowDefinition } from "./types"
import { RuntimeState } from "./graph/state"
import { LangGraphCompiler } from "./graph/compiler"
import { LangGraphRunner } from "./graph/runner"
import { TemplateEngine } from "./template/engine"

export class Runtime {
  private readonly registry: NodeRegistry
  private readonly compiler: LangGraphCompiler
  private readonly runner: LangGraphRunner
  private readonly template: TemplateEngine

  constructor(ai: AIClient) {
    this.registry = new NodeRegistry([
      new AgentNode(ai),
      new TransformNode(),
      new HttpNode(),
    ])

    this.template = new TemplateEngine()

    this.compiler = new LangGraphCompiler(this.registry, this.template)
    this.runner = new LangGraphRunner()
  }

  async execute(workflow: WorkflowDefinition, state: RuntimeState) {
    const compiled = this.compiler.compile(workflow)
    return this.runner.run(compiled, state)
  }
}
