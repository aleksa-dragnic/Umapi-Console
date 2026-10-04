import { createApiClient } from '@/lib/api/create-client';

/**
 * The client for the three auth calls - login, refresh and logout - typed from
 * the generated document like `api`, but without `api`'s middleware: an auth
 * call never carries the access token and never triggers a refresh of its own
 * (ADR 0008). `api` refreshes through this client, so the two cannot be one.
 * Until M5 these paths were typed by hand in `auth-contract.ts` (ADR 0007).
 */
export const authApi = createApiClient();
