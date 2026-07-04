export interface HttpNodeConfig {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  url: string
  headers: Record<string, string>
  body?: unknown
}

export interface HttpResult {
  status: number
  headers: Record<string, string>
  body: unknown
}
