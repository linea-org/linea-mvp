export type AIOptions = {
  openaiApiKey?: string
  anthropicApiKey?: string
  groqApiKey?: string
  xaiApiKey?: string
  googleApiKey?: string
  encryption: { keys: EncryptionKeys }
}

export type EncryptionKeys = {
  [key: number]: string | undefined
}
