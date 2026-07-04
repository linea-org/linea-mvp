import { AIClient } from "@linea/ai"
import { Runtime } from "../src/runtime"
import { WorkflowDefinition } from "../src/types"
import { Database } from "@linea/db"

async function main() {
  const db = new Database({
    connectionURL: "postgresql://linea:linea@localhost:5432/linea",
  })
  const ai = new AIClient(
    {
      openaiApiKey: "",
      anthropicApiKey: "",
      googleApiKey: "[[ REDACTED ]]",
      groqApiKey: "",
      xaiApiKey: "",
      encryption: {
        keys: {},
      },
    },
    db
  )

  const runtime = new Runtime(ai)

  const workflow: WorkflowDefinition = {
    startNode: "transform",

    nodes: [
      {
        id: "transform",
        name: "Transform",
        type: "transform",
        config: {
          variables: {
            name: "Priyanshu",
          },
        },
      },
      {
        id: "agent",
        name: "Agent",
        type: "agent",
        config: {
          provider: "google",
          model: "gemini-3.5-flash",
          systemPrompt: "You are a helpful assistant.",
          messages: [
            {
              role: "user",
              content: "Say hello to {{name}}.",
            },
          ],
          temperature: 0,
          maxTokens: 200,
          tools: [],
        },
      },
    ],

    edges: [
      {
        id: "1",
        source: "transform",
        target: "agent",
      },
    ],
  }

  const result = await runtime.execute(workflow, {
    workspaceId: "9473507f-1ab9-42aa-a471-04547e7fca06",
    workflowId: "3b6bef4c-605a-4a76-822c-af7ec09ff7f0",
    threadId: crypto.randomUUID(),
    variables: {},
  })

  console.log(result.variables)
}

main().catch(console.error)
