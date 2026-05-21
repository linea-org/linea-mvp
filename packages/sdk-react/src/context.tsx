'use client';

import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { LineaClient } from '@linea/sdk';

interface LineaContextValue {
  client: LineaClient;
  apiKey: string;
  baseUrl: string;
}

const LineaContext = createContext<LineaContextValue | null>(null);

const DEFAULT_BASE = 'https://api.linea.io/v1';

export interface LineaProviderProps {
  /** API key starting with lnk_ — from your Linea workspace settings */
  apiKey: string;
  /** Override the API base URL (useful for self-hosted or local dev) */
  baseUrl?: string;
  children: ReactNode;
}

export function LineaProvider({ apiKey, baseUrl = DEFAULT_BASE, children }: LineaProviderProps) {
  const value = useMemo<LineaContextValue>(
    () => ({ client: new LineaClient({ apiKey, baseUrl }), apiKey, baseUrl }),
    [apiKey, baseUrl],
  );
  return <LineaContext.Provider value={value}>{children}</LineaContext.Provider>;
}

export function useLineaContext(): LineaContextValue {
  const ctx = useContext(LineaContext);
  if (!ctx) throw new Error('[Linea] useLineaContext must be used inside <LineaProvider>');
  return ctx;
}
