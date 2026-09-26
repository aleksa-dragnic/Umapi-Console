import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';

import { currentAccessToken, subscribeAccessToken } from '@/lib/api/access-token';

/**
 * Server state goes through TanStack Query (ADR 0010).
 *
 * - `retry: false`: a 401 is already met by the silent refresh (ADR 0008), and
 *   a 5xx or a 429 is a state with its own Retry (inventory sections 2.5, 2.8),
 *   so a second automatic attempt only spends the rate limit (row 52).
 * - `refetchOnWindowFocus: false`: a read costs one of a hundred a minute, and
 *   the directory refetches when its URL changes, not when a tab is focused.
 *
 * The cache belongs to one session. When the access token is cleared - a sign
 * out, a session the API ended - every cached response is dropped, so the next
 * account signed in on this tab never sees the last one's data.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
    },
  });
}

/** Clears `client` whenever the session ends. Returns the function that stops it. */
export function clearOnSessionEnd(client: QueryClient): () => void {
  return subscribeAccessToken(() => {
    if (currentAccessToken() === null) client.clear();
  });
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(createQueryClient);
  useEffect(() => clearOnSessionEnd(client), [client]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
