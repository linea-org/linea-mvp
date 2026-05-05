'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { createApiClient } from '@/lib/api';
import { useWorkspace } from '@/contexts/workspace-context';

interface Space {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

interface SpaceContextValue {
  spaces: Space[];
  activeSpace: Space | null;
  setActiveSpace: (space: Space) => void;
  loading: boolean;
  reload: () => void;
}

const SpaceContext = createContext<SpaceContextValue>({
  spaces: [],
  activeSpace: null,
  setActiveSpace: () => {},
  loading: true,
  reload: () => {},
});

export function SpaceProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  const { activeWorkspace, loading: wsLoading } = useWorkspace();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [activeSpace, setActiveSpaceState] = useState<Space | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (wsLoading || !activeWorkspace) {
      if (!wsLoading) setLoading(false);
      return;
    }

    setLoading(true);

    async function load() {
      try {
        const token = await getToken();
        if (!token) return;
        const api = createApiClient(token);
        const data = await api.get<Space[]>(`/workspaces/${activeWorkspace!.id}/spaces`);
        setSpaces(data);

        const storedId = localStorage.getItem(`activeSpaceId_${activeWorkspace!.id}`);
        const active = data.find((s) => s.id === storedId) ?? data[0] ?? null;
        setActiveSpaceState(active);
      } catch {
        setSpaces([]);
        setActiveSpaceState(null);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [activeWorkspace, wsLoading, getToken, tick]);

  function setActiveSpace(space: Space) {
    setActiveSpaceState(space);
    if (activeWorkspace) {
      localStorage.setItem(`activeSpaceId_${activeWorkspace.id}`, space.id);
    }
  }

  function reload() {
    setTick((t) => t + 1);
  }

  return (
    <SpaceContext.Provider value={{ spaces, activeSpace, loading, setActiveSpace, reload }}>
      {children}
    </SpaceContext.Provider>
  );
}

export function useSpace() {
  return useContext(SpaceContext);
}
