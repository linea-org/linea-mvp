import { cn } from "@linea/ui/lib/utils"
import { Spinner } from "@linea/ui/components/spinner"

/** Centered spinner filling its container — for Suspense fallbacks and full-panel loading states. */
function PageSpinner({ className }: { className?: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <Spinner className={cn("size-5 text-muted-foreground", className)} />
    </div>
  )
}

export { PageSpinner }
