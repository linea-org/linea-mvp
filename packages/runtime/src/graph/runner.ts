import { RuntimeState } from "./state"
import { CompiledWorkflow } from "./compiler"

export class LangGraphRunner {
  async run(
    workflow: CompiledWorkflow,
    state: RuntimeState
  ): Promise<RuntimeState> {
    return workflow.invoke(state)
  }
}
