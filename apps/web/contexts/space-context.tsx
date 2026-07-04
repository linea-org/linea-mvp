"use client"

<<<<<<< HEAD
import { createContext, useContext, useEffect, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { createApiClient } from "@/lib/api"
import { useWorkspace } from "@/contexts/workspace-context"
=======
import { createContext, useContext, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import { createApiClient } from '@/lib/api';
import { useWorkspace } from '@/contexts/workspace-context';
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))

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
<<<<<<< HEAD
  const { getToken } = useAuth()
  const { activeWorkspace, loading: wsLoading } = useWorkspace()
  const [pods, setPods] = useState<Pod[]>([])
  const [activePod, setActivePodState] = useState<Pod | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (wsLoading || !activeWorkspace) {
      if (!wsLoading) setLoading(false)
      return
    }

    setLoading(true)

    async function load() {
      try {
        const token = await getToken()
        if (!token) return
        const api = createApiClient(token)
        const data = await api.get<Pod[]>(
          `/workspaces/${activeWorkspace!.id}/pods`
        )
        setPods(data)

        const storedId = localStorage.getItem(
          `activePodId_${activeWorkspace!.id}`
        )
        const active = data.find((p) => p.id === storedId) ?? data[0] ?? null
        setActivePodState(active)
      } catch {
        setPods([])
        setActivePodState(null)
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [activeWorkspace, wsLoading, getToken, tick])
=======
  const { getToken } = useAuth();
  const { activeWorkspace, loading: wsLoading } = useWorkspace();
  const [activePod, setActivePodState] = useState<Pod | null>(null);
  const [syncedFor, setSyncedFor] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const podsKey = ['pods', activeWorkspace?.id];

  const { data: pods = [], isLoading: podsLoading } = useQuery<Pod[]>({
    queryKey: podsKey,
    enabled: !!activeWorkspace,
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      const api = createApiClient(token);
      return api.get<Pod[]>(`/workspaces/${activeWorkspace!.id}/pods`);
    },
  });

  const loading = wsLoading ? true : !activeWorkspace ? false : podsLoading;

  if (activeWorkspace && !podsLoading && syncedFor !== activeWorkspace.id) {
    setSyncedFor(activeWorkspace.id);
    const storedId = localStorage.getItem(`activePodId_${activeWorkspace.id}`);
    setActivePodState(pods.find((p) => p.id === storedId) ?? pods[0] ?? null);
  }
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))

  function setActivePod(pod: Pod) {
    setActivePodState(pod)
    if (activeWorkspace) {
      localStorage.setItem(`activePodId_${activeWorkspace.id}`, pod.id)
    }
  }

  function reload() {
<<<<<<< HEAD
    setTick((t) => t + 1)
=======
    void queryClient.invalidateQueries({ queryKey: podsKey });
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
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
