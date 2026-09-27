import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';

import {
  CONCURRENCY_COPY,
  CONFLICT_COPY,
  DetailScreen,
  FORBIDDEN_REASON,
  NOT_FOUND_COPY,
  formatUtc,
} from '@/features/users/DetailScreen';
import { UNREACHABLE_COPY } from '@/features/users/Failure';
import { USER_PATH, USERS_PATH, userPath, type DetailEntry } from '@/features/users/paths';
import { NO_ROLES_COPY, lockCopy, removeRoleCopy, unlockCopy } from '@/features/users/UserDialogs';
import { setAccessToken } from '@/lib/api/access-token';
import { db } from '@/lib/testing/db';
import type { MockUser } from '@/lib/testing/factories';
import { MOCK_ACCOUNTS, simulateColdStart } from '@/lib/testing/mock';
import { server } from '@/lib/testing/server';
import { call, json, signIn, url, type Session } from '@/lib/testing/support';

// Inventory section 3.4 and its dialogs, 3.5 and 3.6, state by state, against
// the mock. The administrator writes; the demo account holds `users.read` and
// `roles.read` only (row 4), so it meets every write gated (section 2.6).

function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.pathname + location.search}</p>;
}

async function renderDetail(
  id: string,
  account: { email: string; password: string } = MOCK_ACCOUNTS.admin,
  state?: DetailEntry,
) {
  setAccessToken((await signIn(account)).accessToken);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[{ pathname: userPath(id), state }]}>
        <Routes>
          <Route path={USER_PATH} element={<DetailScreen />} />
          <Route path={USERS_PATH} element={<p>Directory</p>} />
        </Routes>
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}

function mockUser(predicate: (user: MockUser) => boolean): MockUser {
  const user = [...db().users.values()].find(predicate);
  if (user === undefined) throw new Error('No mock user matches.');
  return user;
}

const demo = () => mockUser((user) => user.id === MOCK_ACCOUNTS.demo.id);
const identity = () => screen.getByRole('region', { name: 'Identity' });
const roles = () => screen.getByRole('region', { name: 'Roles' });
const concurrency = () => screen.getByRole('region', { name: 'Concurrency' });
const ready = () => screen.findByRole('button', { name: 'Edit' });
const fieldValue = (label: string) =>
  within(identity()).getByText(label, { selector: 'dt' }).nextElementSibling?.textContent;
const etagShown = () => within(concurrency()).getByText(/^W\//).textContent;

/** A second tab, as the administrator: changes the record behind the screen's back. */
async function elsewhere(): Promise<Session> {
  return signIn(MOCK_ACCOUNTS.admin);
}

function captured(): string[] {
  const seen: string[] = [];
  server.events.on('request:start', ({ request }) => {
    if (request.method !== 'GET') seen.push(`${request.method} ${new URL(request.url).pathname}`);
  });
  return seen;
}

afterEach(() => server.events.removeAllListeners());

describe('the user detail (inventory section 3.4)', () => {
  it('loading: the header shows the email the directory handed over, and the panels are skeletons', async () => {
    await renderDetail(MOCK_ACCOUNTS.demo.id, MOCK_ACCOUNTS.admin, {
      email: MOCK_ACCOUNTS.demo.email,
      directorySearch: '?q=demo',
    });

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(MOCK_ACCOUNTS.demo.email);
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true');
    expect(within(identity()).queryByText('Demo')).not.toBeInTheDocument();
    await ready();
  });

  it('ready: identity, roles and the ETag exactly as received, with what it does not do', async () => {
    const session = await signIn(MOCK_ACCOUNTS.admin);
    const wire = await call(`/api/v1/users/${MOCK_ACCOUNTS.demo.id}`, { headers: session.auth });
    const user = demo();
    await renderDetail(user.id);
    await ready();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(user.email);
    expect(within(identity()).getByText('Demo')).toBeInTheDocument();
    expect(within(identity()).getByText('Reader')).toBeInTheDocument();
    expect(within(identity()).getByText('Active')).toBeInTheDocument();
    expect(fieldValue('Created')).toBe(formatUtc(user.createdAtUtc));
    expect(fieldValue('Updated')).toBe(formatUtc(user.updatedAtUtc));
    const [member] = within(roles()).getAllByRole('row').slice(1);
    expect(member).toHaveTextContent('Member');
    expect(member).toHaveTextContent(formatUtc(user.roles[0]?.assignedAtUtc ?? ''));
    expect(etagShown()).toBe(wire.headers.get('ETag'));
    expect(within(concurrency()).getByText(CONCURRENCY_COPY)).toBeInTheDocument();
  });

  it('not-found: a 404 says so, with the way back to the directory', async () => {
    await renderDetail('00000000-0000-4000-8000-000000000000');

    expect(await screen.findByText(NOT_FOUND_COPY)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Back to users' }));
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/users$/);
  });

  it('error: the status and title at panel level, and Retry reads again (section 2.8)', async () => {
    // The mock has no 5xx on the detail; the transport shape of section 2.8, once.
    server.use(
      http.get(
        url('/api/v1/users/:id'),
        () =>
          HttpResponse.json(
            { status: 503, title: 'Service Unavailable' },
            { status: 503, headers: { 'Content-Type': 'application/problem+json' } },
          ),
        { once: true },
      ),
    );
    await renderDetail(MOCK_ACCOUNTS.demo.id);

    expect(await screen.findByRole('alert')).toHaveTextContent('503 Service Unavailable');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await ready();
  });

  it('gated: the demo account meets every write disabled with its reason, and nothing is sent (Gate 3)', async () => {
    await renderDetail(MOCK_ACCOUNTS.demo.id, MOCK_ACCOUNTS.demo);
    await ready();
    const requests = captured();
    const held = 'This account holds users.read, roles.read.';

    const controls: Array<[string, string]> = [
      ['Edit', `Requires users.write. ${held}`],
      ['Lock', `Requires users.lock. ${held}`],
      ['Assign role', `Requires roles.manage. ${held}`],
      ['Remove Member', `Requires roles.manage. ${held}`],
    ];
    for (const [name, reason] of controls) {
      const control = screen.getByRole('button', { name });
      expect(control).toHaveAttribute('aria-disabled', 'true');
      expect(control).toHaveAccessibleDescription(reason);
      await userEvent.click(control);
    }

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Edit profile' })).not.toBeInTheDocument();
    expect(requests).toEqual([]);
  });

  it('saving: an edit shows at once, then the detail is read again for its new ETag (row 57)', async () => {
    const client = await renderDetail(MOCK_ACCOUNTS.demo.id);
    await userEvent.click(await ready());
    const before = etagShown();
    const invalidated = vi.spyOn(client, 'invalidateQueries');

    expect(screen.getByLabelText('Email')).toHaveFocus();
    await userEvent.clear(screen.getByLabelText('Last name'));
    await userEvent.type(screen.getByLabelText('Last name'), 'Writer');
    // Slow the write, so the state between the change and the answer can be seen.
    simulateColdStart(300);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await within(identity()).findByText('Writer')).toBeInTheDocument();
    expect(within(concurrency()).getByRole('status')).toHaveTextContent('Saving');
    await waitFor(() => expect(within(concurrency()).queryByRole('status')).toBeNull());
    expect(etagShown()).not.toBe(before);
    expect(demo().lastName).toBe('Writer');
    expect(invalidated).toHaveBeenCalledWith({ queryKey: ['users', 'directory'] });
    expect(screen.getByRole('button', { name: 'Edit' })).toHaveFocus();
  });

  it('invalid: a 422 rolls back and lands on its field, whatever the casing of its key (row 19)', async () => {
    await renderDetail(MOCK_ACCOUNTS.demo.id);
    await userEvent.click(await ready());

    await userEvent.clear(screen.getByLabelText('First name'));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    const field = await screen.findByLabelText('First name');
    await waitFor(() => expect(field).toHaveFocus());
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription(/must not be empty/);
    expect(demo().firstName).toBe('Demo');
  });

  it('invalid: an email another user holds is a message on the email field, not a conflict (row 49)', async () => {
    await renderDetail(MOCK_ACCOUNTS.demo.id);
    await userEvent.click(await ready());

    await userEvent.clear(screen.getByLabelText('Email'));
    await userEvent.type(screen.getByLabelText('Email'), MOCK_ACCOUNTS.admin.email);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    const field = await screen.findByLabelText('Email');
    expect(field).toHaveAccessibleDescription('The email is already in use.');
    expect(field).toHaveValue(MOCK_ACCOUNTS.admin.email);
    expect(screen.queryByText(CONFLICT_COPY)).not.toBeInTheDocument();
  });

  it('a save with no answer keeps what was typed and says nothing answered', async () => {
    server.use(http.put(url('/api/v1/users/:id'), () => HttpResponse.error(), { once: true }));
    await renderDetail(MOCK_ACCOUNTS.demo.id);
    await userEvent.click(await ready());

    await userEvent.type(screen.getByLabelText('Last name'), 's');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(UNREACHABLE_COPY);
    expect(screen.getByLabelText('Last name')).toHaveValue('Readers');
  });

  it('conflict: a stale tab locking a locked user rolls back and offers Reload (rows 49, 58)', async () => {
    await renderDetail(MOCK_ACCOUNTS.demo.id);
    await ready();
    const other = await elsewhere();
    await call(`/api/v1/users/${MOCK_ACCOUNTS.demo.id}/lock`, {
      method: 'POST',
      headers: other.auth,
    });

    await userEvent.click(screen.getByRole('button', { name: 'Lock' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Lock' }));

    const panel = await screen.findByRole('region', { name: 'Conflict' });
    expect(panel).toHaveTextContent('The user is already locked.');
    expect(panel).toHaveTextContent(CONFLICT_COPY);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(within(identity()).getByText('Active')).toBeInTheDocument();

    await userEvent.click(within(panel).getByRole('button', { name: 'Reload' }));

    expect(await within(identity()).findByText('Locked')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Conflict' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unlock' })).toBeInTheDocument();
  });

  it('forbidden: a 403 is an error in place, and the control that earned it disables (section 2.5)', async () => {
    // The mock grants the administrator everything; a token the API no longer honours, once.
    server.use(
      http.post(
        url('/api/v1/users/:id/lock'),
        () =>
          HttpResponse.json(
            { status: 403, title: 'Forbidden' },
            { status: 403, headers: { 'Content-Type': 'application/problem+json' } },
          ),
        { once: true },
      ),
    );
    await renderDetail(MOCK_ACCOUNTS.demo.id);
    await userEvent.click(await screen.findByRole('button', { name: 'Lock' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Lock' }));

    const alert = await within(identity()).findByRole('alert');
    expect(alert).toHaveTextContent('Locking or unlocking was refused: 403 Forbidden.');
    const lock = screen.getByRole('button', { name: 'Lock' });
    expect(lock).toHaveAttribute('aria-disabled', 'true');
    expect(lock).toHaveAccessibleDescription(FORBIDDEN_REASON);

    await userEvent.click(within(alert).getByRole('button', { name: 'Dismiss' }));
    expect(within(identity()).queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lock' })).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('lock-user and unlock-user (inventory section 3.6)', () => {
  it('states the consequence, starts on Cancel, and gives focus back to Lock', async () => {
    const user = demo();
    await renderDetail(user.id);
    const lock = await screen.findByRole('button', { name: 'Lock' });
    await userEvent.click(lock);

    const dialog = screen.getByRole('dialog', { name: 'Lock Demo Reader' });
    expect(dialog).toHaveTextContent(lockCopy('Demo Reader'));
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(lock).toHaveFocus();
    expect(user.status).toBe('Active');
  });

  it('locks, and the detail read again says so', async () => {
    await renderDetail(MOCK_ACCOUNTS.demo.id);
    await userEvent.click(await screen.findByRole('button', { name: 'Lock' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Lock' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(within(identity()).getByText('Locked')).toBeInTheDocument();
    expect(demo().status).toBe('Locked');
  });

  it('unlocking is not destructive: the dialog starts on Unlock', async () => {
    const other = await elsewhere();
    await call(`/api/v1/users/${MOCK_ACCOUNTS.demo.id}/lock`, {
      method: 'POST',
      headers: other.auth,
    });
    await renderDetail(MOCK_ACCOUNTS.demo.id);
    await userEvent.click(await screen.findByRole('button', { name: 'Unlock' }));

    const dialog = screen.getByRole('dialog', { name: 'Unlock Demo Reader' });
    expect(dialog).toHaveTextContent(unlockCopy('Demo Reader'));
    const unlock = within(dialog).getByRole('button', { name: 'Unlock' });
    expect(unlock).toHaveFocus();

    await userEvent.click(unlock);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(within(identity()).getByText('Active')).toBeInTheDocument();
  });

  it('refused: a deactivated user is offered the action, and the API states its rule (row 49)', async () => {
    const user = mockUser((candidate) => candidate.status === 'Deactivated');
    await renderDetail(user.id);
    await userEvent.click(await screen.findByRole('button', { name: 'Lock' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Lock' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('The user is deactivated.');
    expect(within(dialog).queryByRole('button', { name: 'Lock' })).not.toBeInTheDocument();
    expect(within(identity()).getByText('Deactivated')).toBeInTheDocument();
  });

  it('rate-limited: a 429 holds the action until Retry-After has passed (section 2.7)', async () => {
    server.use(
      http.post(
        url('/api/v1/users/:id/lock'),
        () =>
          HttpResponse.json(
            { status: 429, title: 'Too Many Requests' },
            {
              status: 429,
              headers: { 'Content-Type': 'application/problem+json', 'Retry-After': '30' },
            },
          ),
        { once: true },
      ),
    );
    await renderDetail(MOCK_ACCOUNTS.demo.id);
    await userEvent.click(await screen.findByRole('button', { name: 'Lock' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Lock' }));

    const lock = await within(dialog).findByRole('button', { name: 'Lock' });
    await waitFor(() =>
      expect(lock).toHaveAccessibleDescription('Too many attempts. Try again in 30 seconds.'),
    );
    expect(lock).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('assign-role (inventory section 3.5)', () => {
  it('offers the roles the user does not hold, and the assignment shows as pending until read', async () => {
    await renderDetail(MOCK_ACCOUNTS.demo.id);
    await userEvent.click(await screen.findByRole('button', { name: 'Assign role' }));

    const dialog = screen.getByRole('dialog', { name: 'Assign a role to Demo Reader' });
    const select = await within(dialog).findByLabelText('Role');
    await waitFor(() => expect(select).toHaveFocus());
    expect(
      within(select)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Administrator', 'Support']);

    await userEvent.selectOptions(select, 'Support');
    simulateColdStart(300);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Assign' }));

    // The client's clock is not the server's: no assignment time until the API has one.
    expect(await within(roles()).findByText('pending')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Assign' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const rows = within(roles()).getAllByRole('row').slice(1);
    expect(rows.map((row) => within(row).getAllByRole('cell')[0]?.textContent)).toEqual([
      'Member',
      'Support',
    ]);
    expect(rows[1]).not.toHaveTextContent('pending');
  });

  it('no-roles-available: a user holding every role is told so, and Assign is disabled', async () => {
    const session = await signIn(MOCK_ACCOUNTS.admin);
    for (const name of ['Support', 'Member']) {
      const role = [...db().roles.values()].find((candidate) => candidate.name === name);
      await call(`/api/v1/users/${MOCK_ACCOUNTS.admin.id}/roles`, {
        method: 'POST',
        ...json({ roleId: role?.id }, session.auth),
      });
    }
    await renderDetail(MOCK_ACCOUNTS.admin.id);
    await userEvent.click(await screen.findByRole('button', { name: 'Assign role' }));

    const dialog = screen.getByRole('dialog');
    const assign = await within(dialog).findByRole('button', { name: 'Assign' });
    expect(assign).toHaveAttribute('aria-disabled', 'true');
    expect(assign).toHaveAccessibleDescription(NO_ROLES_COPY);
  });

  it('conflict: a role assigned from another tab closes the dialog, and the record shows the conflict', async () => {
    await renderDetail(MOCK_ACCOUNTS.demo.id);
    await userEvent.click(await screen.findByRole('button', { name: 'Assign role' }));
    const dialog = screen.getByRole('dialog');
    const select = await within(dialog).findByLabelText('Role');
    const other = await elsewhere();
    await call(`/api/v1/users/${MOCK_ACCOUNTS.demo.id}/roles`, {
      method: 'POST',
      ...json({ roleId: (select as HTMLSelectElement).value }, other.auth),
    });

    await userEvent.click(within(dialog).getByRole('button', { name: 'Assign' }));

    const panel = await screen.findByRole('region', { name: 'Conflict' });
    expect(panel).toHaveTextContent('The user already holds this role.');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(within(roles()).getAllByRole('row')).toHaveLength(2);
  });

  it('invalid: a 422 is shown inside the dialog, and focus goes to the role', async () => {
    // The dialog always sends a role, so the API's 422 on an empty one (the
    // mock's cited branch) cannot be reached from it; its shape, once.
    server.use(
      http.post(
        url('/api/v1/users/:id/roles'),
        () =>
          HttpResponse.json(
            {
              status: 422,
              title: 'Unprocessable Entity',
              errorCode: 'Validation.General',
              errors: { RoleId: ["'Role Id' must not be empty."] },
            },
            { status: 422, headers: { 'Content-Type': 'application/problem+json' } },
          ),
        { once: true },
      ),
    );
    await renderDetail(MOCK_ACCOUNTS.demo.id);
    await userEvent.click(await screen.findByRole('button', { name: 'Assign role' }));
    const dialog = screen.getByRole('dialog');
    const select = await within(dialog).findByLabelText('Role');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Assign' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      "'Role Id' must not be empty.",
    );
    expect(select).toHaveFocus();
  });
});

describe('remove-role (inventory section 3.6)', () => {
  it('states what is removed, starts on Cancel, and removes', async () => {
    const user = mockUser((candidate) => candidate.roles.length === 2);
    const name = `${user.firstName} ${user.lastName}`;
    await renderDetail(user.id);
    await userEvent.click(await screen.findByRole('button', { name: 'Remove Support' }));

    const dialog = screen.getByRole('dialog', { name: `Remove Support from ${name}` });
    expect(dialog).toHaveTextContent(removeRoleCopy(name, 'Support'));
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(within(roles()).getAllByRole('row')).toHaveLength(2);
    expect(within(roles()).queryByText('Support')).not.toBeInTheDocument();
  });

  it("refused: the API keeps a user's last role and says why (row 50)", async () => {
    await renderDetail(MOCK_ACCOUNTS.demo.id);
    await userEvent.click(await screen.findByRole('button', { name: 'Remove Member' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'A user must keep at least one role.',
    );
    expect(within(dialog).queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
    expect(within(roles()).getByText('Member')).toBeInTheDocument();
  });
});
