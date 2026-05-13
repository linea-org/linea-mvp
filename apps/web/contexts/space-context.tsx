'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { createApiClient } from '@/lib/api';
import { useWorkspace } from '@/contexts/workspace-context';

interface Pod {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

interface PodContextValue {
  pods: Pod[];
  activePod: Pod | null;
  setActivePod: (pod: Pod) => void;
  loading: boolean;
  reload: () => void;
}

const PodContext = createContext<PodContextValue>({
  pods: [],
  activePod: null,
  setActivePod: () => {},
  loading: true,
  reload: () => {},
});

export function PodProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  const { activeWorkspace, loading: wsLoading } = useWorkspace();
  const [pods, setPods] = useState<Pod[]>([]);
  const [activePod, setActivePodState] = useState<Pod | null>(null);
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
        const data = await api.get<Pod[]>(`/workspaces/${activeWorkspace!.id}/pods`);
        setPods(data);

        const storedId = localStorage.getItem(`activePodId_${activeWorkspace!.id}`);
        const active = data.find((p) => p.id === storedId) ?? data[0] ?? null;
        setActivePodState(active);
      } catch {
        setPods([]);
        setActivePodState(null);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [activeWorkspace, wsLoading, getToken, tick]);

  function setActivePod(pod: Pod) {
    setActivePodState(pod);
    if (activeWorkspace) {
      localStorage.setItem(`activePodId_${activeWorkspace.id}`, pod.id);
    }
  }

  function reload() {
    setTick((t) => t + 1);
  }

  return (
    <PodContext.Provider value={{ pods, activePod, loading, setActivePod, reload }}>
      {children}
    </PodContext.Provider>
  );
}

export function usePod() {
  return useContext(PodContext);
}
