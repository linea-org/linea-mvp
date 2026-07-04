export interface HttpNodeConfig {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  url: string
  headers: Record<string, string>
  body?: unknown
}
