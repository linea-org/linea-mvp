"use client"

import { JsonView, defaultStyles } from "react-json-view-lite"
import "react-json-view-lite/dist/index.css"
import { cn } from "@linea/ui/lib/utils"

export function JsonOrPre({
  value,
  className,
}: {
  value: unknown
  className?: string
}) {
  const parsed = (() => {
    if (typeof value === "object" && value !== null) return value
    if (typeof value === "string") {
      try {
        const p = JSON.parse(value)
        if (typeof p === "object" && p !== null) return p
      } catch {
        /* ignore */
      }
    }
    return null
  })()
  if (parsed) {
    return (
      <div className={className}>
        <JsonView
          data={parsed}
          shouldExpandNode={(level) => level < 2}
          style={defaultStyles}
        />
      </div>
    )
  }
  return (
    <pre className={cn("font-mono break-words whitespace-pre-wrap", className)}>
      {String(value ?? "")}
    </pre>
  )
}
