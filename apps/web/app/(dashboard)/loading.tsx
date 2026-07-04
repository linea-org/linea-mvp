import { Skeleton } from "@linea/ui/components/skeleton"

export default function DashboardLoading() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-7 w-48" />
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    </div>
  )
}
