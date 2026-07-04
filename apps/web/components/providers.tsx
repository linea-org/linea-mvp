"use client"

<<<<<<< HEAD
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"
=======
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from '@linea/ui/components/sonner';
import { friendlyApiError } from '@/lib/api';

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: { skipGlobalErrorToast?: boolean };
    mutationMeta: { skipGlobalErrorToast?: boolean };
  }
}
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))

export function ReactQueryProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 60 * 1000, retry: 1 } },
<<<<<<< HEAD
      })
  )
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
=======
        queryCache: new QueryCache({
          onError: (err, query) => {
            if (query.meta?.skipGlobalErrorToast) return;
            toast.error(friendlyApiError(err));
          },
        }),
        mutationCache: new MutationCache({
          onError: (err, _vars, _ctx, mutation) => {
            if (mutation.meta?.skipGlobalErrorToast) return;
            toast.error(friendlyApiError(err));
          },
        }),
      }),
  );
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
}
