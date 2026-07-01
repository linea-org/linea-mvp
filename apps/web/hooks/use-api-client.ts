import { useAuth } from '@clerk/nextjs';
import { createApiClient } from '@/lib/api';

export function useApiClient() {
  const { getToken } = useAuth();
  return async () => {
    const token = await getToken();
    if (!token) throw new Error('Not authenticated');
    return createApiClient(token);
  };
}
