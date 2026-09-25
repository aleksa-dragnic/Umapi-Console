import { createApiClient } from '@/lib/api/create-client';
import { silentRefresh } from '@/lib/api/refresh';
import type { paths } from '@/lib/api/schema';

export { API_BASE_URL, DEPLOYED_API_ORIGIN, createApiClient } from '@/lib/api/create-client';
export type { Schema } from '@/lib/api/create-client';

export type ApiClient = ReturnType<typeof createApiClient<paths>>;

/**
 * The one client the application uses for everything but the three auth calls.
 * It sends the access token from memory (build plan section 4.5); with none
 * held, the request goes out without one and the API answers 401. A 401 on a
 * request that carried a token is met by one silent refresh and a replay
 * (inventory section 2.3, ADR 0008).
 */
export const api: ApiClient = createApiClient();

api.use(silentRefresh);
