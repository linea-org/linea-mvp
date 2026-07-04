import { cn } from "@linea/ui/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import { Loading01Icon } from "@hugeicons/core-free-icons"

function Spinner({ className }: { className?: string }) {
  return (
    <HugeiconsIcon icon={Loading01Icon} strokeWidth={2} role="status" aria-label="Loading" className={cn("size-4 animate-spin", className)} />
  )
}

export { Spinner }
