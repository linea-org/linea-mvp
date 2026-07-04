export interface TransformNodeConfig {
  values: Record<string, string>
  variables: Record<string, unknown>
}

export interface TransformResult {
  values: Record<string, string>
}
