import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useRef } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';

import { CRASHED_COPY, ISSUES_URL } from '@/app/ErrorBoundary';
import { OFFLINE_COPY, Shell } from '@/app/Shell';
import { RequireSession, SessionBoundary } from '@/features/auth';
import { clearCaptures } from '@/lib/api/capture';
import { api } from '@/lib/api/client';
import { MOCK_ACCOUNTS, simulateColdStart } from '@/lib/testing/mock';
import { signIn } from '@/lib/testing/support';
import { COLD_START_COPY } from '@/ui/ColdStartNotice';

function Screen({ title }: { title: string }) {
  return (
    <main>
      <h1 tabIndex={-1}>{title}</h1>
      <button type="button">Inside {title}</button>
    </main>
  );
}

/** A screen that places focus itself, as the directory does for the opened row. */
function Placing() {
  const target = useRef<HTMLButtonElement>(null);
  useEffect(() => target.current?.focus(), []);
  return (
    <main>
      <h1 tabIndex={-1}>Placing</h1>
      <button ref={target} type="button">
        Placed
      </button>
    </main>
  );
}

function Crash(): never {
  throw new Error('a feature failed');
}

async function renderShell(entry = '/users') {
  await signIn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route element={<SessionBoundary />}>
            <Route element={<RequireSession />}>
              <Route element={<Shell />}>
                <Route path="/users" element={<Screen title="Users" />} />
                <Route path="/roles" element={<Screen title="Roles" />} />
                <Route path="/placing" element={<Placing />} />
                <Route path="/session" element={<Crash />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await screen.findByRole('navigation', { name: 'Console' });
}

const nav = () => screen.getByRole('navigation', { name: 'Console' });

beforeEach(() => clearCaptures());

describe('the shell', () => {
  it('carries the navigation, marks where the user is, and names the account with Sign out', async () => {
    await renderShell();

    expect(within(nav()).getByRole('link', { name: 'Users' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav()).getByRole('link', { name: 'Roles' })).not.toHaveAttribute('aria-current');
    expect(within(nav()).getByRole('link', { name: 'Session' })).toBeInTheDocument();
    expect(screen.getByText(MOCK_ACCOUNTS.demo.email)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Inspector' })).toBeInTheDocument();
  });

  it("moves focus to the new screen's h1 on a change of route (inventory section 4)", async () => {
    await renderShell();

    await userEvent.click(within(nav()).getByRole('link', { name: 'Roles' }));

    expect(screen.getByRole('heading', { name: 'Roles' })).toHaveFocus();
  });

  it('leaves focus where a screen placed it inside its main', async () => {
    await renderShell('/placing');

    expect(screen.getByRole('button', { name: 'Placed' })).toHaveFocus();
  });

  it('offline: a bar beneath the header while the browser is offline, gone when it is back (section 2.2)', async () => {
    await renderShell();

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByRole('alert')).toHaveTextContent(OFFLINE_COPY);

    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.queryByText(OFFLINE_COPY)).not.toBeInTheDocument();
  });

  it('cold-start: the line comes with the first slow request and not again this session (section 2.1)', async () => {
    await renderShell();

    simulateColdStart(1500);
    let read: Promise<unknown> = Promise.resolve();
    act(() => {
      read = api.GET('/api/v1/roles');
    });
    expect(await screen.findByText(COLD_START_COPY, {}, { timeout: 2000 })).toBeInTheDocument();
    await act(() => read);
    await vi.waitFor(() => expect(screen.queryByText(COLD_START_COPY)).not.toBeInTheDocument());

    simulateColdStart(1500);
    act(() => {
      read = api.GET('/api/v1/roles');
    });
    await act(() => new Promise((resolve) => setTimeout(resolve, 1300)));
    expect(screen.queryByText(COLD_START_COPY)).not.toBeInTheDocument();
    await act(() => read);
  });

  it('error boundary: a screen that fails to render is replaced, and the navigation survives (section 3.11)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await renderShell('/session');

    expect(screen.getByRole('heading', { name: CRASHED_COPY })).toBeInTheDocument();
    expect(screen.getByText('Component stack')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Report it on GitHub' })).toHaveAttribute(
      'href',
      ISSUES_URL,
    );

    await userEvent.click(within(nav()).getByRole('link', { name: 'Users' }));

    expect(screen.getByRole('heading', { name: 'Users' })).toBeInTheDocument();
    expect(screen.queryByText(CRASHED_COPY)).not.toBeInTheDocument();
  });
});
