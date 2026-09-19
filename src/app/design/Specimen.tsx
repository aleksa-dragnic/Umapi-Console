import { useState, type ReactNode } from 'react';

import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { CodeWindow } from '@/ui/CodeWindow';
import { Dialog } from '@/ui/Dialog';
import { Input } from '@/ui/Input';
import { StatusDot } from '@/ui/StatusDot';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/ui/Table';
import type { SortDirection } from '@/ui/Table';

/**
 * The specimen route: every primitive in ui/, in every state the screen
 * inventory lists for it, on one page and in both densities. It is where the
 * design is reviewed for the rest of the project, and where a new state is
 * drawn before it is wired to anything.
 *
 * Hover, focus ring and reduced motion are not rendered as separate cases.
 * They are states of the same control, and a static copy of one would drift
 * from the real thing - they are reviewed here with a pointer and a keyboard.
 *
 * Development only. See AppRoutes for how it leaves the production bundle.
 */

const RESPONSE_BODY = `{
  "id": "7c41ab",
  "email": "marko.jovanovic@example.com",
  "status": "Active"
}`;

const REQUEST_HEAD = `GET /api/v1/users?page=2&q=ovic
Authorization: Bearer $TOKEN
If-None-Match: "8f4e1c"`;

function Specimens({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section aria-label={label} className="flex flex-col gap-app-2">
      <p className="font-mono text-app-label uppercase text-fg-muted">{label}</p>
      <div className="flex flex-wrap items-start gap-[var(--density-gap)]">{children}</div>
    </section>
  );
}

function LockGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 12"
      className="size-3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
    >
      <rect x="2.5" y="5.5" width="7" height="5" rx="1" />
      <path d="M4.5 5.5V4a1.5 1.5 0 0 1 3 0v1.5" />
    </svg>
  );
}

function Gallery({ density }: { density: 'application' | 'editorial' }) {
  const [emailSort, setEmailSort] = useState<SortDirection>('ascending');
  const [dialog, setDialog] = useState<'none' | 'plain' | 'destructive'>('none');

  return (
    <div
      data-density={density}
      // Both densities on one page is the single exception to DESIGN-DECISIONS
      // section 11: a screen belongs to one density for its whole life, and
      // this page exists to compare them side by side.
      style={{ fontSize: 'var(--density-body)' }}
      className="flex flex-col gap-[var(--density-gap)] rounded-card border border-border-default p-[var(--density-pad)]"
    >
      <h2 className="text-app-title text-fg-emphasis">
        {density === 'application' ? 'Application density' : 'Editorial density'}
      </h2>

      <Specimens label="Button">
        <Button>Assign role</Button>
        <Button variant="destructive">Lock user</Button>
        <Button disabledReason="Requires users.write. This account holds users.read, roles.read.">
          Create user
        </Button>
        <Button pending>Saving</Button>
      </Specimens>

      <Specimens label="Input">
        <div className="w-64">
          <Input label="Email" />
        </div>
        <div className="w-64">
          <Input label="Email" defaultValue="marko.jovanovic@example.com" />
        </div>
        <div className="w-64">
          <Input label="Email" defaultValue="marko" error="Email must be a valid address." />
        </div>
        <div className="w-64">
          <Input label="Search" placeholder="Filter by name or email" />
        </div>
      </Specimens>

      <Specimens label="Card">
        <Card title="Identity" className="w-72">
          <p className="text-fg-secondary">marko.jovanovic@example.com</p>
        </Card>
        <Card className="w-72">
          <p className="text-fg-secondary">A panel with no title.</p>
        </Card>
      </Specimens>

      <Specimens label="Badge">
        <Badge>users.read</Badge>
        <Badge>Administrator</Badge>
        <span className="flex flex-wrap gap-app-1">
          <Badge>users.read</Badge>
          <Badge>users.write</Badge>
          <Badge>roles.read</Badge>
        </span>
      </Specimens>

      <Specimens label="StatusDot">
        <StatusDot status={200} />
        <StatusDot status={304} />
        <StatusDot status={422} />
        <StatusDot status={503} />
        <StatusDot />
      </Specimens>

      <Specimens label="CodeWindow">
        <CodeWindow title="GET /api/v1/users/7c41ab" className="w-96">
          {RESPONSE_BODY}
        </CodeWindow>
        <CodeWindow className="w-96">{REQUEST_HEAD}</CodeWindow>
        <CodeWindow title="GET /api/v1/users" truncatedAtKb={64} className="w-96">
          {RESPONSE_BODY}
        </CodeWindow>
      </Specimens>

      <Specimens label="Table">
        <div className="w-full">
          <Table caption="Users, with one sortable and one unsortable column">
            <TableHead>
              <TableRow>
                <TableHeaderCell
                  sort={emailSort}
                  onSort={() => {
                    setEmailSort(emailSort === 'ascending' ? 'descending' : 'ascending');
                  }}
                >
                  Email
                </TableHeaderCell>
                <TableHeaderCell sort="descending" onSort={() => undefined}>
                  Created
                </TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell className="font-mono text-fg-identifier">
                  marko.jovanovic@example.com
                </TableCell>
                <TableCell className="font-mono text-fg-secondary">2026-02-11</TableCell>
                <TableCell>Active</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono text-fg-identifier">
                  ana.petrovic@example.com
                </TableCell>
                <TableCell className="font-mono text-fg-secondary">2026-03-04</TableCell>
                <TableCell className="text-fg-muted">Pending</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono text-fg-identifier">
                  ivan.nikolic@example.com
                </TableCell>
                <TableCell className="font-mono text-fg-secondary">2026-03-19</TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-app-1 text-fg-muted">
                    <LockGlyph />
                    Locked
                  </span>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <div className="w-full">
          <Table caption="Users, with an empty body">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Email</TableHeaderCell>
                <TableHeaderCell>Created</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody />
          </Table>
          <p className="p-app-3 text-fg-muted">{'No users match "ovic".'}</p>
        </div>
      </Specimens>

      <Specimens label="Dialog">
        <Button
          onClick={() => {
            setDialog('plain');
          }}
        >
          Open dialog
        </Button>
        <Button
          variant="destructive"
          onClick={() => {
            setDialog('destructive');
          }}
        >
          Open destructive dialog
        </Button>
      </Specimens>

      <Dialog
        open={dialog === 'plain'}
        title="Assign a role"
        onClose={() => {
          setDialog('none');
        }}
      >
        <p className="text-fg-secondary">
          Marko Jovanovic holds Reader. Assigning a second role adds its permissions.
        </p>
        <Button>Assign</Button>
      </Dialog>

      <Dialog
        open={dialog === 'destructive'}
        destructive
        title="Lock this user"
        onClose={() => {
          setDialog('none');
        }}
      >
        <p className="text-fg-secondary">
          Locking Ana Petrovic signs out their sessions and refuses new sign-ins until unlocked.
        </p>
        <Button variant="destructive">Lock user</Button>
      </Dialog>
    </div>
  );
}

export default function Specimen() {
  return (
    <main className="flex flex-col gap-app-5 p-app-5">
      <header className="flex flex-col gap-app-1">
        <h1 className="text-app-title text-fg-emphasis">Design specimen</h1>
        <p className="font-mono text-app-meta text-fg-muted">
          Development only. Every primitive in ui/, in both densities. Hover, focus and reduced
          motion are reviewed here with a pointer and a keyboard.
        </p>
      </header>
      <Gallery density="application" />
      <Gallery density="editorial" />
    </main>
  );
}
