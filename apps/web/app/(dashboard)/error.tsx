'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@linea/ui/components/button';

export default function DashboardError({
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

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="space-y-2">
        <h2 className="text-base font-semibold">Something went wrong</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          {error.message || 'An unexpected error occurred loading this page.'}
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground font-mono">ID: {error.digest}</p>
        )}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => router.push('/')}>Dashboard</Button>
        <Button size="sm" onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
