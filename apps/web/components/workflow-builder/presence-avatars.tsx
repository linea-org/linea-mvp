"use client"

import { useEffect, useState } from "react"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@linea/ui/components/avatar"
import { useApiClient } from "@/hooks/use-api-client"

interface Presence {
  userId: string
  name: string | null
  email: string
  avatarUrl: string | null
}

interface Props {
  workspaceId: string
  podId: string
  workflowId: string
}

export function PresenceAvatars({ workspaceId, podId, workflowId }: Props) {
  const [others, setOthers] = useState<Presence[]>([])
  const getApi = useApiClient()

  useEffect(() => {
    const path = `/workspaces/${workspaceId}/pods/${podId}/workflows/${workflowId}/presence`

    async function ping() {
      try {
        const api = await getApi()
        const data = await api.post<Presence[]>(path, {})
        setOthers(data ?? [])
      } catch {
        // presence endpoint not yet available — stay silent
      }
    }

    void ping()
    const interval = setInterval(() => void ping(), 20_000)
    return () => clearInterval(interval)
  }, [getApi, workspaceId, podId, workflowId])

  if (others.length === 0) return null

  const visible = others.slice(0, 4)
  const overflow = others.length - visible.length

  return (
    <div
      className="flex items-center"
      title={others.map((u) => u.name ?? u.email).join(", ")}
    >
      {visible.map((u, i) => (
        <div
          key={u.userId}
          className="relative rounded-full ring-2 ring-background"
          style={{ marginLeft: i === 0 ? 0 : -8, zIndex: visible.length - i }}
          title={u.name ?? u.email}
        >
          <Avatar className="size-6">
            {u.avatarUrl && <AvatarImage src={u.avatarUrl} />}
            <AvatarFallback className="text-[10px]">
              {(u.name ?? u.email)[0]?.toUpperCase() ?? "?"}
            </AvatarFallback>
          </Avatar>
        </div>
      ))}
      {overflow > 0 && (
        <div
          className="relative flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground ring-2 ring-background"
          style={{ marginLeft: -8 }}
        >
          +{overflow}
        </div>
      )}
    </div>
  )
}
