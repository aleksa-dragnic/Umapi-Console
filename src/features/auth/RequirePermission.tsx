import { Outlet } from 'react-router';

import { useCan, type Permission } from '@/lib/api/permissions';

/**
 * A route that needs one permission, on top of `RequireSession` (inventory
 * section 2.6, ADR 0009). An account without it meets the route's gated state
 * in place - the same reason a gated control states, and no redirect: the
 * address stays what the user asked for. The demo account and the
 * administrator both hold every read permission (observed row 4), so no route
 * in the console is gated for either; this is the rule for one that would be.
 */
export const GATED_ROUTE_HEADING = 'Not available to this account';

export function RequirePermission({ permission }: { permission: Permission }) {
  const permit = useCan(permission);

  if (permit.allowed) return <Outlet />;
  return (
    <main className="flex flex-col gap-app-2 p-app-4">
      <h1 tabIndex={-1} className="text-app-title text-fg-emphasis">
        {GATED_ROUTE_HEADING}
      </h1>
      <p className="font-mono text-app-meta text-fg-muted">{permit.reason}</p>
    </main>
  );
}
