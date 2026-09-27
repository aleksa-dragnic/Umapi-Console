import { useRoles } from '@/features/users/api';
import { Failure } from '@/features/users/Failure';
import { Badge } from '@/ui/Badge';
import { SkeletonRow } from '@/ui/SkeletonRow';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/ui/Table';

/**
 * The `roles` screen (inventory section 3.7): each role and what it permits.
 * Read-only by design - the API seeds its roles and does not manage them over
 * HTTP in v1 - and the screen says so rather than leaving it as an absence.
 * It reads what the assign-role dialog reads, from the same cache entry.
 */

export const ROLES_PATH = '/roles';
export const READ_ONLY_COPY = 'Roles are seeded by the API and are read-only in v1.';

export function RolesScreen() {
  const roles = useRoles(true);
  const data = roles.data;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-app-4 p-app-4">
      <div className="flex flex-col gap-app-1">
        <h1 tabIndex={-1} className="text-app-title text-fg-emphasis">
          Roles
        </h1>
        <p className="text-fg-secondary">{READ_ONLY_COPY}</p>
      </div>

      {roles.isError && data === undefined ? (
        <Failure
          key={roles.errorUpdatedAt}
          error={roles.error}
          onRetry={() => void roles.refetch()}
        />
      ) : (
        <div className="overflow-x-auto">
          <Table caption="Roles">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Role</TableHeaderCell>
                <TableHeaderCell>Permissions</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data === undefined
                ? [0, 1].map((index) => <SkeletonRow key={index} columns={2} />)
                : data.roles.map((role) => (
                    <TableRow key={role.id}>
                      <TableCell className="whitespace-nowrap">{role.name}</TableCell>
                      <TableCell className="py-app-1">
                        <ul
                          aria-label={`${role.name} permissions`}
                          className="flex flex-wrap gap-app-1"
                        >
                          {role.permissions.map((permission) => (
                            <li key={permission}>
                              <Badge>{permission}</Badge>
                            </li>
                          ))}
                        </ul>
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </div>
      )}
    </main>
  );
}
