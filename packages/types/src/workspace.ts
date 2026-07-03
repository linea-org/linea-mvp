import type { ID, Timestamp } from "./common.js"

export type WorkspacePlan = "free" | "pro" | "team" | "enterprise"

export interface Workspace {
  id: ID
  slug: string
  name: string
  plan: WorkspacePlan
  createdAt: Timestamp
  updatedAt: Timestamp
}
