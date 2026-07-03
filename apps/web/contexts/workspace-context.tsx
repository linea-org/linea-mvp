"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { createApiClient } from "@/lib/api"

interface Workspace {
  id: string
  name: string
  slug: string
  plan?: string
}

interface WorkspaceContextValue {
  workspaces: Workspace[]
  activeWorkspace: Workspace | null
  setActiveWorkspace: (ws: Workspace | null) => void
  addWorkspace: (ws: Workspace) => void
  removeWorkspace: (id: string) => void
  loading: boolean
}

const WorkspaceContext = createContext<WorkspaceContextValue>({
  workspaces: [],
  activeWorkspace: null,
  setActiveWorkspace: () => {},
  addWorkspace: () => {},
  removeWorkspace: () => {},
  loading: true,
})

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [activeWorkspace, setActiveWorkspaceState] = useState<Workspace | null>(
    null
  )
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken()
        if (!token) return
        const api = createApiClient(token)
        const raw =
          await api.get<
            Array<{ id: string; name: string; slug: string; plan?: string }>
          >("/workspaces")
        const data: Workspace[] = raw.map(({ id, name, slug, plan }) => ({
          id,
          name,
          slug,
          plan,
        }))
        setWorkspaces(data)

        const storedId = localStorage.getItem("activeWorkspaceId")
        const active = data.find((w) => w.id === storedId) ?? data[0] ?? null
        setActiveWorkspaceState(active)
      } catch {
        // silently fail — user may not have a workspace yet
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [getToken])

  function setActiveWorkspace(ws: Workspace | null) {
    setActiveWorkspaceState(ws)
    if (ws) {
      localStorage.setItem("activeWorkspaceId", ws.id)
    } else {
      localStorage.removeItem("activeWorkspaceId")
    }
  }

  function addWorkspace(ws: Workspace) {
    setWorkspaces((prev) => [...prev, ws])
    setActiveWorkspace(ws)
  }

  function removeWorkspace(id: string) {
    setWorkspaces((prev) => {
      const next = prev.filter((w) => w.id !== id)
      // If the deleted workspace was active, switch to first remaining or null
      if (activeWorkspace?.id === id) {
        setActiveWorkspace(next[0] ?? null)
      }
      return next
    })
  }

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspace,
        loading,
        setActiveWorkspace,
        addWorkspace,
        removeWorkspace,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  return useContext(WorkspaceContext)
}
