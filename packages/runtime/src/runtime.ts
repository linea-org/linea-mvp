import { AIClient } from "@linea/ai"
import { NodeRegistry } from "./registry.js"
import { AgentNode } from "./nodes/agent/agent.node.js"
import { TransformNode } from "./nodes/transform/transform.node.js"
import { HttpNode } from "./nodes/http/http.node.js"
import type { RuntimeState } from "./types.js"
import { LangGraphCompiler } from "./graph/compiler.js"
import { LangGraphRunner } from "./graph/runner.js"
import { TemplateEngine } from "./template/engine.js"
import { VariableMap, WorkflowDefinition } from "@linea/shared/contracts"

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

  async execute(
    workflow: WorkflowDefinition,
    input: VariableMap,
    state: RuntimeState
  ) {
    const definition = this.template.renderWorkflow(workflow, input)
    const compiled = this.compiler.compile(definition)
    return this.runner.run(compiled, state)
  }
}
