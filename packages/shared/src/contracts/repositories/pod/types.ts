export type NewPod = {
  name: string
  slug: string
  workspaceId: string
  id?: string | undefined
  createdAt?: Date | undefined
  updatedAt?: Date | undefined
  description?: string | null | undefined
}

export type Pod = {
  id: string
  name: string
  slug: string
  createdAt: Date
  updatedAt: Date
  workspaceId: string
  description: string | null
}
