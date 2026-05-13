'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { createApiClient } from '@/lib/api';

interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan?: string;
}

interface WorkspaceContextValue {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  setActiveWorkspace: (ws: Workspace) => void;
  addWorkspace: (ws: Workspace) => void;
  loading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue>({
  workspaces: [],
  activeWorkspace: null,
  setActiveWorkspace: () => {},
  addWorkspace: () => {},
  loading: true,
});

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspaceState] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken();
        if (!token) return;
        const api = createApiClient(token);
        const raw = await api.get<Array<{ id: string; name: string; slug: string; plan?: string }>>('/workspaces');
        const data: Workspace[] = raw.map(({ id, name, slug, plan }) => ({ id, name, slug, plan }));
        setWorkspaces(data);

        const storedId = localStorage.getItem('activeWorkspaceId');
        const active = data.find((w) => w.id === storedId) ?? data[0] ?? null;
        setActiveWorkspaceState(active);
      } catch {
        // silently fail — user may not have a workspace yet
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [getToken]);

  function setActiveWorkspace(ws: Workspace) {
    setActiveWorkspaceState(ws);
    localStorage.setItem('activeWorkspaceId', ws.id);
  }

  function addWorkspace(ws: Workspace) {
    setWorkspaces((prev) => [...prev, ws]);
    setActiveWorkspace(ws);
  }

  return (
    <WorkspaceContext.Provider value={{ workspaces, activeWorkspace, loading, setActiveWorkspace, addWorkspace }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
