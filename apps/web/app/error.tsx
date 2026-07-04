"use client"

import { useEffect } from "react"
import { Button } from "@linea/ui/components/button"

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="space-y-2">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          An unexpected error occurred. If this keeps happening, try refreshing
          the page.
        </p>
        {error.digest && (
          <p className="font-mono text-xs text-muted-foreground">
            Error ID: {error.digest}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => (window.location.href = "/")}>
          Go home
        </Button>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  )
}
