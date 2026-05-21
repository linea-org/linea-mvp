'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@linea/ui/components/button';

export default function BuilderError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const router = useRouter();
  const params = useParams<{ podId: string }>();

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background text-center">
      <div className="space-y-2">
        <h2 className="text-base font-semibold">Builder error</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          {error.message || 'The workflow builder encountered an unexpected error.'}
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground font-mono">ID: {error.digest}</p>
        )}
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(params?.podId ? `/pods/${params.podId}/workflows` : '/')}
        >
          Back to workflows
        </Button>
        <Button size="sm" onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
