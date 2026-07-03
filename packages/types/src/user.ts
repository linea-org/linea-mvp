import type { ID, Timestamp } from "./common.js"

export interface User {
  id: ID
  clerkId: string
  email: string
  name: string | null
  avatarUrl: string | null
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface UserProfile extends User {
  workspaces: Array<{
    id: ID
    name: string
    slug: string
    role: WorkspaceMemberRole
  }>
}

export type WorkspaceMemberRole = "owner" | "admin" | "editor" | "viewer"

export interface WorkspaceMember {
  workspaceId: ID
  userId: ID
  role: WorkspaceMemberRole
  joinedAt: Timestamp
  user: Pick<User, "id" | "email" | "name" | "avatarUrl">
}

export interface WorkspaceInvite {
  id: ID
  workspaceId: ID
  email: string
  role: WorkspaceMemberRole
  token: string
  expiresAt: Timestamp
  createdAt: Timestamp
}
