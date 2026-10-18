import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useRef } from 'react';
import { Link, MemoryRouter, Route, Routes } from 'react-router';

import { CRASHED_COPY, ISSUES_URL } from '@/app/ErrorBoundary';
import { OFFLINE_COPY, SKIP_COPY, Shell } from '@/app/Shell';
import { RequireSession, SessionBoundary } from '@/features/auth';
import { DirectoryScreen } from '@/features/users';
import { clearCaptures } from '@/lib/api/capture';
import { api } from '@/lib/api/client';
import { MOCK_ACCOUNTS, simulateColdStart } from '@/lib/testing/mock';
import { signIn } from '@/lib/testing/support';
import { COLD_START_AFTER_MS, COLD_START_COPY } from '@/ui/ColdStartNotice';

function Screen({ title }: { title: string }) {
  return (
    <main>
      <h1 tabIndex={-1}>{title}</h1>
      <button type="button">Inside {title}</button>
      <Link to={title === 'Outside' ? '/users' : '/outside'}>
        {title === 'Outside' ? 'Back in' : 'Leave'}
      </Link>
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
                <Route path="/directory" element={<DirectoryScreen />} />
                <Route path="/session" element={<Crash />} />
              </Route>
              <Route path="/outside" element={<Screen title="Outside" />} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  // The boot refresh goes through the mock in real time. On a loaded machine it
  // has taken longer than findBy's default second, so the wait is stated.
  await screen.findByRole('navigation', { name: 'Console' }, { timeout: 3000 });
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

  it("offers Skip to content first, and it lands on the screen's h1", async () => {
    await renderShell();
    (document.activeElement as HTMLElement | null)?.blur();

    await userEvent.tab();
    const skip = screen.getByRole('link', { name: SKIP_COPY });
    expect(skip).toHaveFocus();
    await userEvent.keyboard('{Enter}');

    expect(screen.getByRole('heading', { name: 'Users' })).toHaveFocus();
  });

  it('Escape closes the inspector before it clears the search (inventory section 4)', async () => {
    await renderShell('/directory');
    const search = await screen.findByLabelText('Search');
    await userEvent.type(search, 'ovic');
    await userEvent.click(screen.getByRole('button', { name: 'Inspector' }));
    await userEvent.click(search);

    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Inspector' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(search).toHaveValue('ovic');

    await userEvent.click(search);
    await userEvent.keyboard('{Escape}');
    expect(search).toHaveValue('');
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
    // From here the clock is the test's: the threshold and the mock's cold
    // start are both timers, so the outcome no longer depends on the machine.
    vi.useFakeTimers();
    try {
      simulateColdStart(1500);
      let read: Promise<unknown> = Promise.resolve();
      act(() => {
        read = api.GET('/api/v1/roles');
      });
      await act(() => vi.advanceTimersByTimeAsync(COLD_START_AFTER_MS - 1));
      expect(screen.queryByText(COLD_START_COPY)).not.toBeInTheDocument();
      await act(() => vi.advanceTimersByTimeAsync(1));
      // The line is ColdStartNotice with afterMs 0: it shows on its next tick.
      await act(() => vi.advanceTimersByTimeAsync(1));
      expect(screen.getByText(COLD_START_COPY)).toBeInTheDocument();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500 - COLD_START_AFTER_MS);
        await read;
      });
      expect(screen.queryByText(COLD_START_COPY)).not.toBeInTheDocument();

      simulateColdStart(1500);
      act(() => {
        read = api.GET('/api/v1/roles');
      });
      await act(() => vi.advanceTimersByTimeAsync(COLD_START_AFTER_MS + 100));
      await act(() => vi.advanceTimersByTimeAsync(1));
      expect(screen.queryByText(COLD_START_COPY)).not.toBeInTheDocument();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500);
        await read;
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('cold-start: a shell mounted again in the same session does not show the line again (section 2.1)', async () => {
    await renderShell();
    vi.useFakeTimers();
    try {
      const slowRead = async () => {
        simulateColdStart(1500);
        let read: Promise<unknown> = Promise.resolve();
        act(() => {
          read = api.GET('/api/v1/roles');
        });
        await act(() => vi.advanceTimersByTimeAsync(COLD_START_AFTER_MS));
        await act(() => vi.advanceTimersByTimeAsync(1));
        await act(() => vi.advanceTimersByTimeAsync(1));
        const shown = screen.queryByText(COLD_START_COPY) !== null;
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1500);
          await read;
        });
        return shown;
      };

      expect(await slowRead()).toBe(true);
      // Out of the shell and back: the shell is mounted afresh, the session is not.
      fireEvent.click(screen.getByRole('link', { name: 'Leave' }));
      fireEvent.click(screen.getByRole('link', { name: 'Back in' }));
      expect(await slowRead()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
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
