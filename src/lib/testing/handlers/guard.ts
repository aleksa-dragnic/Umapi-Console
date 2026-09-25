import { coldStart, overLimit, RETRY_AFTER_SECONDS } from '@/lib/testing/limits';
import type { Policy } from '@/lib/testing/limits';
import { frameworkProblem, rateLimitProblem } from '@/lib/testing/problems';
import { checkBearer } from '@/lib/testing/tokens';
import type { MockUser } from '@/lib/testing/factories';

export type Guarded =
  { ok: true; user: MockUser; permissions: string[] } | { ok: false; response: Response };

/**
 * What every authenticated endpoint does first, in the instance's order:
 * authentication (401, framework shape - rows 10, 34), then authorisation (403,
 * framework shape, before any validation - row 27), then the rate limit keyed by
 * user id (row 52).
 */
export async function guard(
  request: Request,
  permission: string,
  policy: Policy,
): Promise<Guarded> {
  await coldStart();
  const bearer = checkBearer(request);
  if (!bearer.ok) {
    // Row 10 also sends `WWW-Authenticate`; a browser cannot read it (row 53).
    return { ok: false, response: frameworkProblem(request, 401) };
  }
  if (!bearer.permissions.includes(permission)) {
    return { ok: false, response: frameworkProblem(request, 403) };
  }
  if (overLimit(policy, bearer.user.id)) {
    return { ok: false, response: rateLimitProblem(request, RETRY_AFTER_SECONDS) };
  }
  return { ok: true, user: bearer.user, permissions: bearer.permissions };
}
