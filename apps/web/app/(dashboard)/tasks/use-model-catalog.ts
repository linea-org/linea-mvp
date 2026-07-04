'use client';

import { useQuery } from '@tanstack/react-query';
import { useApiClient } from '@/hooks/use-api-client';
import type { ModelOption } from './types';

interface ModelDefinition {
  id: string;
  name: string;
  provider: string;
  tier: 'fast' | 'balanced' | 'powerful' | 'reasoning';
  badge?: string;
}

const TIER_HINTS: Record<ModelDefinition['tier'], string> = {
  fast: 'Fast',
  balanced: 'Balanced',
  powerful: 'Powerful',
  reasoning: 'Reasoning',
};

export function useModelCatalog() {
  const getApi = useApiClient();
  return useQuery<ModelOption[]>({
    queryKey: ['models'],
    queryFn: async () => {
      const api = await getApi();
      const models = await api.get<ModelDefinition[]>('/models');
      return models.map((m) => ({
        id: m.id,
        label: m.name,
        hint: TIER_HINTS[m.tier] ?? 'Balanced',
        provider: m.provider,
        badge: m.badge,
      }));
    },
  });
}
