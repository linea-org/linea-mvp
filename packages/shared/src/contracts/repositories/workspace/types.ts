export type WorkspaceWithMemberResult = {
  workspace: Workspace
  member: WorkspaceMember
}

export type Workspace = {
  id: string
  name: string
  slug: string
  plan: "free" | "pro" | "team" | "enterprise"
  clerkOrgId: string | null
  settings: WorkspaceSettings
  createdAt: Date
  updatedAt: Date
}

export type NewWorkspace = {
  name: string
  slug: string
  id?: string | undefined
  plan?: "free" | "pro" | "team" | "enterprise" | undefined
  clerkOrgId?: string | null | undefined
  settings?: WorkspaceSettings | undefined
  createdAt?: Date | undefined
  updatedAt?: Date | undefined
}

export interface WorkspaceSettings {
  modelFallbackChain?: string[]
  ragSimilarityThreshold?: number
  ragChunkSize?: number
  ragChunkOverlap?: number
  supervisorModel?: string
}

export type WorkspaceMember = {
  workspaceId: string
  userId: string
  role: "owner" | "admin" | "editor" | "viewer"
  joinedAt: Date
}
