import { AIClient } from "@linea/ai"
import { Runtime } from "../src/runtime"
import { Database } from "@linea/db"

async function main() {
  const db = new Database({
    connectionURL: "",
  })
  const ai = new AIClient(
    {
      encryption: { keys: {} },
      anthropicApiKey: "",
      googleApiKey: "",
    },
    db
  )

  const runtime = new Runtime(ai)
  const agent = runtime.registryInstance.get("agent")
  console.log(agent.type)
}

main()
