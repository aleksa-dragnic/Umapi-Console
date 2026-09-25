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
 * Creates a typed client for the API.
 *
 * `credentials: 'include'` is set once, here, so the refresh cookie travels on
 * every call to the API origin (build plan section 3.2).
 *
 * `fetch` is looked up on every request instead of being captured when the
 * client is created. openapi-fetch would otherwise keep the `fetch` that
 * existed at import time, and a request interceptor installed later - the
 * mock layer in tests - would never see the call.
 */
export function createApiClient(baseUrl: string = API_BASE_URL) {
  return createClient<paths>({
    baseUrl,
    credentials: 'include',
    fetch: (request: Request) => globalThis.fetch(request),
  });
}

export type ApiClient = ReturnType<typeof createApiClient>;

/** The one client the application uses. */
export const api: ApiClient = createApiClient();
