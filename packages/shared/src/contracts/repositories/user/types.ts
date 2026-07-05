export type User = {
  id: string
  name: string | null
  createdAt: Date
  updatedAt: Date
  clerkId: string
  email: string
  avatarUrl: string | null
  onboardedAt: Date | null
}

export type NewUser = {
  clerkId: string
  email: string
  id?: string | undefined
  name?: string | null | undefined
  createdAt?: Date | undefined
  updatedAt?: Date | undefined
  avatarUrl?: string | null | undefined
  onboardedAt?: Date | null | undefined
}
