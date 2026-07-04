import { Annotation } from "@langchain/langgraph"
import { VariableMap } from "../nodes/node"

export const RuntimeStateAnnotation = Annotation.Root({
  workspaceId: Annotation<string>(),
  workflowId: Annotation<string>(),
  threadId: Annotation<string>(),
  variables: Annotation<VariableMap>({
    reducer: (left, right) => ({
      ...left,
      ...right,
    }),
    default: () => ({}),
  }),
})

export type RuntimeState = typeof RuntimeStateAnnotation.State
