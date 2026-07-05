export type ProviderConnection = {
  id: string
  createdAt: Date
  updatedAt: Date
  workspaceId: string
  expiresAt: Date | null
  authType: string
  provider: string
  providerUserId: string | null
  providerEmail: string | null
  enabled: boolean
  configEncrypted: string
  encryptionKeyVersion: number
  encryptionIV: string
  encryptionAuthTag: string
}

export type NewProviderConnection = {
  workspaceId: string
  authType: string
  provider: string
  configEncrypted: string
  encryptionIV: string
  encryptionAuthTag: string
  id?: string | undefined
  createdAt?: Date | undefined
  updatedAt?: Date | undefined
  expiresAt?: Date | null | undefined
  providerUserId?: string | null | undefined
  providerEmail?: string | null | undefined
  enabled?: boolean | undefined
  encryptionKeyVersion?: number | undefined
}
