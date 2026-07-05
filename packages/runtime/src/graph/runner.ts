import { RuntimeState } from "../types.js"
import { CompiledWorkflow } from "./compiler.js"

export class LangGraphRunner {
  async run(
    workflow: CompiledWorkflow,
    state: RuntimeState
  ): Promise<RuntimeState> {
    return workflow.invoke(state)
  }
}
