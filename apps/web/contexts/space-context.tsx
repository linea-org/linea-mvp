"use client"

import { createContext, useContext, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@clerk/nextjs"
import { createApiClient } from "@/lib/api"
import { useWorkspace } from "@/contexts/workspace-context"

interface Pod {
  id: string
  name: string
  slug: string
  description: string | null
}

interface PodContextValue {
  pods: Pod[]
  activePod: Pod | null
  setActivePod: (pod: Pod) => void
  loading: boolean
  reload: () => void
}

const PodContext = createContext<PodContextValue>({
  pods: [],
  activePod: null,
  setActivePod: () => {},
  loading: true,
  reload: () => {},
})

export function PodProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth()
  const { activeWorkspace, loading: wsLoading } = useWorkspace()
  const [activePod, setActivePodState] = useState<Pod | null>(null)
  const [syncedFor, setSyncedFor] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const podsKey = ["pods", activeWorkspace?.id]

  const { data: pods = [], isLoading: podsLoading } = useQuery<Pod[]>({
    queryKey: podsKey,
    enabled: !!activeWorkspace,
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error("Not authenticated")
      const api = createApiClient(token)
      return api.get<Pod[]>(`/workspaces/${activeWorkspace!.id}/pods`)
    },
  })

  const loading = wsLoading ? true : !activeWorkspace ? false : podsLoading

  if (activeWorkspace && !podsLoading && syncedFor !== activeWorkspace.id) {
    setSyncedFor(activeWorkspace.id)
    const storedId = localStorage.getItem(`activePodId_${activeWorkspace.id}`)
    setActivePodState(pods.find((p) => p.id === storedId) ?? pods[0] ?? null)
  }

  function setActivePod(pod: Pod) {
    setActivePodState(pod)
    if (activeWorkspace) {
      localStorage.setItem(`activePodId_${activeWorkspace.id}`, pod.id)
    }
  }

  function reload() {
    void queryClient.invalidateQueries({ queryKey: podsKey })
  }

  return (
    <PodContext.Provider
      value={{ pods, activePod, loading, setActivePod, reload }}
    >
      {children}
    </PodContext.Provider>
  )
}

export function usePod() {
  return useContext(PodContext)
}
