import { END, START, StateGraph } from "@langchain/langgraph"

import { NodeRegistry } from "../registry.js"

import { RuntimeStateAnnotation } from "./state.js"
import { TemplateEngine } from "../template/engine.js"
import { WorkflowDefinition, WorkflowNode } from "@linea/shared/contracts"

export class LangGraphCompiler {
  constructor(
    private readonly registry: NodeRegistry,
    private readonly template: TemplateEngine
  ) {}

  private createGraph() {
    const graph = new StateGraph(RuntimeStateAnnotation)

    return graph
  }

  compile(workflow: WorkflowDefinition) {
    this.validate(workflow)

    const graph = this.createGraph()

    this.addNodes(graph, workflow.nodes)
    this.addEdges(graph, workflow)

    return graph.compile()
  }

  private addNodes(
    graph: ReturnType<LangGraphCompiler["createGraph"]>,
    nodes: WorkflowNode[]
  ) {
    for (const node of nodes) {
      const executor = this.registry.get(node.type)

      graph.addNode(node.id, async (state) => {
        const result = await executor.execute({
          state,
          config: node.config,
          template: this.template,
        })

        return {
          variables: result.variables,
        }
      })
    }
  }

  private addEdges(
    graph: ReturnType<LangGraphCompiler["createGraph"]>,
    workflow: WorkflowDefinition
  ) {
    // adding as any as it is the limitation of LangGraph

    graph.addEdge(START, workflow.startNode as any)

    for (const edge of workflow.edges) {
      graph.addEdge(edge.source as any, edge.target as any)
    }

    for (const node of workflow.nodes) {
      const hasOutgoing = workflow.edges.some((edge) => edge.source === node.id)

      if (!hasOutgoing) {
        graph.addEdge(node.id as any, END)
      }
    }
  }

  private validate(workflow: WorkflowDefinition) {
    const ids = new Set(workflow.nodes.map((n) => n.id))

    if (!ids.has(workflow.startNode)) {
      throw new Error(`Unknown start node '${workflow.startNode}'.`)
    }

    for (const edge of workflow.edges) {
      if (!ids.has(edge.source)) {
        throw new Error(`Unknown source node '${edge.source}'.`)
      }

      if (!ids.has(edge.target)) {
        throw new Error(`Unknown target node '${edge.target}'.`)
      }
    }
  }
}

export type CompiledWorkflow = ReturnType<
  ReturnType<LangGraphCompiler["createGraph"]>["compile"]
>
