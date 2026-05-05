'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { createApiClient } from '@/lib/api';
import { Button } from '@linea/ui/components/button';

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const { getToken } = useAuth();
  const router = useRouter();
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    setAccepting(true);
    setError(null);
    try {
      const authToken = await getToken();
      if (!authToken) return;
      const api = createApiClient(authToken);
      const result = await api.post<{ workspaceId: string; role: string }>(`/invites/${token}/accept`);
      router.push(`/spaces`);
      void result;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to accept invite. The link may be expired or invalid.');
    } finally {
      setAccepting(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
      <h1 className="text-xl font-semibold">Workspace invite</h1>
      <p className="text-sm text-muted-foreground max-w-sm">
        You've been invited to join a workspace on Linea. Click below to accept.
      </p>

      {error && (
        <p className="text-sm text-destructive max-w-sm">{error}</p>
      )}

      <Button onClick={() => void handleAccept()} disabled={accepting}>
        {accepting ? 'Accepting…' : 'Accept invite'}
      </Button>
    </div>
  );
}
