import createClient from 'openapi-fetch';

import { captureExchange } from '@/lib/api/capture';
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
 * `cache: 'no-store'` keeps the browser's HTTP cache out of the way. The API
 * marks its reads `private, no-cache` (observed row 22), so the browser would
 * otherwise revalidate on its own and hand the console a 200 from its cache
 * for what was a 304 on the wire. The console keeps its own validators and
 * sends `If-None-Match` itself, so what it shows is what crossed the network.
 * See docs/adr/0013-the-console-keeps-its-own-validators.md.
 *
 * Every request goes out through `transport`, which records it for the
 * inspector (ADR 0014) and looks `fetch` up on every request instead of
 * keeping the one that existed when the client was created. openapi-fetch
 * would otherwise hold on to the `fetch` of import time, and a request
 * interceptor installed later - the mock layer in tests - would never see the
 * call.
 *
 * This file imports nothing from `lib/api` that makes a request, so the auth
 * contract's client and the application's client can both be built from it
 * without a cycle: the application's client refreshes through the auth one.
 */
export function createApiClient<Paths extends object = paths>(baseUrl: string = API_BASE_URL) {
  return createClient<Paths>({
    baseUrl,
    credentials: 'include',
    cache: 'no-store',
    fetch: transport,
  });
}

/**
 * The one way a request reaches the network: recorded for the inspector, then
 * sent with the `fetch` of the moment. The silent refresh sends its replay
 * through here too, so the replay is recorded like any other request.
 */
export function transport(request: Request): Promise<Response> {
  return captureExchange(request, (outgoing) => globalThis.fetch(outgoing));
}
