import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';

import { historyKey, type HistoryEntry } from '@/features/users/api';
import { DetailScreen } from '@/features/users/DetailScreen';
import {
  HISTORY_EMPTY_COPY,
  HISTORY_NOTE_COPY,
  REMOVED_ACTOR,
  SYSTEM_ACTOR,
  actorOf,
  describe as describeChange,
} from '@/features/users/HistoryPanel';
import { USER_PATH, userPath } from '@/features/users/paths';
import { setAccessToken } from '@/lib/api/access-token';
import { MOCK_ACCOUNTS } from '@/lib/testing/mock';
import { server } from '@/lib/testing/server';
import { signIn, url } from '@/lib/testing/support';

// Inventory section 3.4, the History panel (#87), against the mock, whose
// history follows the API's ADR 0025: field names, never values.

async function renderDetail(
  id: string,
  account: { email: string; password: string } = MOCK_ACCOUNTS.admin,
) {
  setAccessToken((await signIn(account)).accessToken);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[userPath(id)]}>
        <Routes>
          <Route path={USER_PATH} element={<DetailScreen />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}

const history = () => screen.getByRole('region', { name: 'History' });
const changes = () =>
  within(within(history()).getByRole('list', { name: 'Changes, newest first' }))
    .getAllByRole('listitem')
    .map((item) => item.textContent);

const entry = (overrides: Partial<HistoryEntry>): HistoryEntry => ({
  occurredAtUtc: '2026-11-24T12:00:00Z',
  action: 'updated',
  fields: [],
  roleId: null,
  roleName: null,
  actorId: null,
  actorEmail: null,
  ...overrides,
});

describe('the History panel (inventory section 3.4)', () => {
  it('ready: the demo account reads a seeded user registered by the system, newest first', async () => {
    await renderDetail(MOCK_ACCOUNTS.demo.id, MOCK_ACCOUNTS.demo);

    await within(await screen.findByRole('region', { name: 'History' })).findByText('Registered');

    const lines = changes();
    expect(lines.at(-1)).toMatch(/^Registered/);
    expect(lines).toContainEqual(expect.stringMatching(/^Role Member assigned/));
    expect(lines.every((line) => line?.includes(`${SYSTEM_ACTOR} ·`))).toBe(true);
    expect(within(history()).getByText(HISTORY_NOTE_COPY)).toBeInTheDocument();
    expect(
      within(history()).getByText(`200 · ${String(lines.length)} changes`),
    ).toBeInTheDocument();
  });

  it('a write on the detail reads the history again: a lock is the newest change, by its actor', async () => {
    await renderDetail(MOCK_ACCOUNTS.demo.id);
    await within(await screen.findByRole('region', { name: 'History' })).findByText('Registered');

    await userEvent.click(screen.getByRole('button', { name: 'Lock' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Lock' }));

    await within(history()).findByText('Status changed');
    expect(changes()[0]).toContain(`Status changed${MOCK_ACCOUNTS.admin.email} ·`);
  });

  it('an edit is reported by the fields that moved, and by name only', async () => {
    await renderDetail(MOCK_ACCOUNTS.demo.id);
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    const lastName = screen.getByLabelText('Last name');
    await userEvent.clear(lastName);
    await userEvent.type(lastName, 'Promenjen');

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await within(history()).findByText('Profile changed: last name');
    expect(history()).not.toHaveTextContent('Promenjen');
  });

  it('not-modified: read again with nothing changed, the footer says 304', async () => {
    const client = await renderDetail(MOCK_ACCOUNTS.demo.id);
    await within(await screen.findByRole('region', { name: 'History' })).findByText('Registered');

    await client.invalidateQueries({ queryKey: historyKey(MOCK_ACCOUNTS.demo.id) });

    expect(await within(history()).findByText(/^304 · \d+ changes$/)).toBeInTheDocument();
  });

  it('empty: a user with nothing recorded says so', async () => {
    server.use(http.get(url('/api/v1/users/:id/history'), () => HttpResponse.json([])));
    await renderDetail(MOCK_ACCOUNTS.demo.id);

    expect(
      await within(await screen.findByRole('region', { name: 'History' })).findByText(
        HISTORY_EMPTY_COPY,
      ),
    ).toBeInTheDocument();
    expect(within(history()).getByText('200 · 0 changes')).toBeInTheDocument();
  });

  it('error: the panel fails alone, with Retry, and the rest of the detail stays', async () => {
    server.use(
      http.get(
        url('/api/v1/users/:id/history'),
        () => HttpResponse.json({ status: 503, title: 'Service Unavailable' }, { status: 503 }),
        { once: true },
      ),
    );
    await renderDetail(MOCK_ACCOUNTS.demo.id);

    const alert = await within(await screen.findByRole('region', { name: 'History' })).findByRole(
      'alert',
    );
    expect(alert).toHaveTextContent('503 Service Unavailable');
    expect(screen.getByRole('region', { name: 'Identity' })).toBeInTheDocument();

    await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }));

    expect(await within(history()).findByText('Registered')).toBeInTheDocument();
  });
});

describe('a change as a sentence', () => {
  it('names each kind of change', () => {
    expect(describeChange(entry({ action: 'registered' }))).toBe('Registered');
    expect(describeChange(entry({ fields: ['status'] }))).toBe('Status changed');
    expect(describeChange(entry({ fields: ['password'] }))).toBe('Password changed');
    expect(describeChange(entry({ fields: ['email'] }))).toBe('Profile changed: email');
    expect(describeChange(entry({ fields: ['email', 'firstName', 'lastName'] }))).toBe(
      'Profile changed: email, first name and last name',
    );
    expect(describeChange(entry({ action: 'roleAssigned', roleName: 'Support' }))).toBe(
      'Role Support assigned',
    );
    expect(describeChange(entry({ action: 'roleRemoved', roleName: null }))).toBe(
      'Role that no longer exists removed',
    );
  });

  it('names the actor: an email, the system, or a user who is gone', () => {
    expect(actorOf(entry({ actorId: 'a', actorEmail: 'admin@umapi.local' }))).toBe(
      'admin@umapi.local',
    );
    expect(actorOf(entry({ actorId: null }))).toBe(SYSTEM_ACTOR);
    expect(actorOf(entry({ actorId: 'gone', actorEmail: null }))).toBe(REMOVED_ACTOR);
  });
});
