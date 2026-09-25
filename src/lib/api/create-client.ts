import createClient from 'openapi-fetch';
import type { components, paths } from '@/lib/api/schema';

/**
 * The deployed instance. The generated schema is read from the same origin
 * (`pnpm api:generate`), so the types and the default target cannot disagree
 * about which API they describe. See docs/adr/0006-generated-api-types.md.
 */
export const DEPLOYED_API_ORIGIN = 'https://usermanagementapi-j1if.onrender.com';

export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL || DEPLOYED_API_ORIGIN;

/** A schema from the generated document, by the name the document gives it. */
export type Schema<K extends keyof components['schemas']> = components['schemas'][K];

/**
 * Creates a typed client for the API. The paths default to the generated
 * document; `auth-contract.ts` passes its own until M5.
 *
 * `credentials: 'include'` is set once, here, so the refresh cookie travels on
 * every call to the API origin (build plan section 3.2).
 *
 * `fetch` is looked up on every request instead of being captured when the
 * client is created. openapi-fetch would otherwise keep the `fetch` that
 * existed at import time, and a request interceptor installed later - the
 * mock layer in tests - would never see the call.
 *
 * This file imports nothing from `lib/api` that makes a request, so the auth
 * contract's client and the application's client can both be built from it
 * without a cycle: the application's client refreshes through the auth one.
 */
export function createApiClient<Paths extends object = paths>(baseUrl: string = API_BASE_URL) {
  return createClient<Paths>({
    baseUrl,
    credentials: 'include',
    fetch: (request: Request) => globalThis.fetch(request),
  });
}
