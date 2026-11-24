import { StrictMode, useEffect } from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';

import { RequireSession } from '@/features/auth/RequireSession';
import { SessionBoundary } from '@/features/auth/SessionBoundary';
import { SIGN_IN_PATH } from '@/features/auth/next';
import { api } from '@/lib/api/client';
import { hadSession, rememberSession } from '@/lib/api/session-hint';
import { advanceClock, simulateColdStart } from '@/lib/testing/mock';
import { server } from '@/lib/testing/server';
import { call, signIn, url } from '@/lib/testing/support';
import { useSession } from '@/features/auth/session';
import { COLD_START_COPY } from '@/ui/ColdStartNotice';
import { rateLimitCopy } from '@/ui/RateLimitNotice';

/** Counts what a test needs to know about the sign-in route: whether it ever mounted. */
const signInMounts = { count: 0 };

function SignInProbe() {
  const location = useLocation();
  useEffect(() => {
    signInMounts.count += 1;
  }, []);
  return <p>sign-in at {location.pathname + location.search}</p>;
}

function renderAt(path: string, { strict = false } = {}) {
  signInMounts.count = 0;
  const tree = (
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<SessionBoundary />}>
          <Route path={SIGN_IN_PATH} element={<SignInProbe />} />
          <Route element={<RequireSession />}>
            <Route path="/users/:id" element={<h1>User detail</h1>} />
          </Route>
        </Route>
      </Routes>
    </MemoryRouter>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}

/** The session's own controls, for a test of their order against a late check. */
function SessionControls() {
  const { state, signIn: adopt, signOut } = useSession();
  return (
    <>
      <p>status {state.status}</p>
      <button type="button" onClick={() => adopt('from-the-sign-in-form')}>
        sign in
      </button>
      <button type="button" onClick={() => void signOut()}>
        sign out
      </button>
    </>
  );
}

function countRefreshes(): { count: number } {
  const seen = { count: 0 };
  server.events.on('request:start', ({ request }) => {
    if (new URL(request.url).pathname === '/api/v1/auth/refresh') seen.count += 1;
  });
  return seen;
}

afterEach(() => {
  server.events.removeAllListeners();
});

describe('boot (inventory section 3.1)', () => {
  it('shows the app mark alone while checking, with no pending indicator yet', () => {
    // The boot screen is for a browser that had a session (ADR 0017).
    rememberSession(true);
    renderAt('/users/7c41ab');

    expect(screen.getByRole('img', { name: 'Umapi Console' })).toBeInTheDocument();
    expect(screen.getByRole('main', { name: 'Checking the session' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    expect(screen.queryByText('pending')).not.toBeInTheDocument();
  });

  it('sends an anonymous visitor to sign-in, keeping the requested path as next', async () => {
    renderAt('/users/7c41ab');

    expect(
      await screen.findByText(
        `sign-in at ${SIGN_IN_PATH}?next=${encodeURIComponent('/users/7c41ab')}`,
      ),
    ).toBeInTheDocument();
  });

  it('restores a session from the refresh cookie without ever mounting sign-in', async () => {
    await signIn();
    renderAt('/users/7c41ab');

    expect(await screen.findByRole('heading', { name: 'User detail' })).toBeInTheDocument();
    expect(signInMounts.count).toBe(0);
  });

  it('asks the API once, even when development renders twice', async () => {
    await signIn();
    const refreshes = countRefreshes();
    renderAt('/users/7c41ab', { strict: true });

    expect(await screen.findByRole('heading', { name: 'User detail' })).toBeInTheDocument();
    expect(refreshes.count).toBe(1);
  });

  it('adds the cold-start line when the answer takes longer than 1200 ms', async () => {
    await signIn();
    simulateColdStart(1500);
    renderAt('/users/7c41ab');

    expect(await screen.findByText(COLD_START_COPY, {}, { timeout: 4000 })).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'User detail' }, { timeout: 4000 }),
    ).toBeInTheDocument();
  });

  it('sends a user whose session ends mid-use to sign-in, keeping the page as next (inventory section 2.4)', async () => {
    await signIn();
    renderAt('/users/7c41ab');
    await screen.findByRole('heading', { name: 'User detail' });
    await call('/api/v1/auth/logout', { method: 'POST' });
    advanceClock(901_000);

    await act(async () => {
      await api.GET('/api/v1/roles');
    });

    expect(
      await screen.findByText(
        `sign-in at ${SIGN_IN_PATH}?next=${encodeURIComponent('/users/7c41ab')}`,
      ),
    ).toBeInTheDocument();
  });

  it('treats a 429 on the boot refresh as a wait, not as signed out (observed row 52)', async () => {
    // The auth budget is ten a minute and the boot refresh is the eleventh call.
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await call('/api/v1/auth/refresh', { method: 'POST' });
    }
    rememberSession(true);
    renderAt('/users/7c41ab');

    expect(await screen.findByRole('status')).toHaveTextContent(rateLimitCopy(60));
    expect(signInMounts.count).toBe(0);
  });
});

describe('without a session hint (ADR 0017)', () => {
  it('shows sign-in at once, before the session check answers, and still sends that check', async () => {
    const refreshes = countRefreshes();
    renderAt('/users/7c41ab');

    // Synchronously: no boot screen to wait through.
    expect(screen.queryByRole('main', { name: 'Checking the session' })).not.toBeInTheDocument();
    expect(screen.getByText('sign-in at /sign-in?next=%2Fusers%2F7c41ab')).toBeInTheDocument();

    await act(() => Promise.resolve());
    await vi.waitFor(() => expect(refreshes.count).toBe(1));
  });

  it('adopts the session the check finds for a user whose hint was lost', async () => {
    await signIn();
    rememberSession(false);
    renderAt('/users/7c41ab');

    // Sign-in first; the real SignInScreen then sends an authenticated user on
    // (SignInScreen.test.tsx), which this probe does not.
    expect(screen.getByText(/^sign-in at/)).toBeInTheDocument();
    // The session it found is adopted and remembered, so the next mount waits.
    await vi.waitFor(() => expect(hadSession()).toBe(true));
  });

  it('does not sign back in a user who signed out while the check was still in flight', async () => {
    // A check that answers with a token only when the test lets it.
    let answer = (): void => undefined;
    const released = new Promise<void>((resolve) => {
      answer = resolve;
    });
    server.use(
      http.post(url('/api/v1/auth/refresh'), async () => {
        await released;
        return HttpResponse.json({ accessToken: 'the-check-was-late' });
      }),
    );
    render(
      <MemoryRouter initialEntries={[SIGN_IN_PATH]}>
        <Routes>
          <Route element={<SessionBoundary />}>
            <Route path={SIGN_IN_PATH} element={<SessionControls />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'sign in' }));
    await userEvent.click(screen.getByRole('button', { name: 'sign out' }));
    expect(screen.getByText('status anonymous')).toBeInTheDocument();

    await act(async () => {
      answer();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(screen.getByText('status anonymous')).toBeInTheDocument();
    expect(hadSession()).toBe(false);
  });

  it('leaves a visitor on sign-in when the check is refused or rate limited', async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await call('/api/v1/auth/refresh', { method: 'POST' });
    }
    renderAt('/users/7c41ab');

    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(screen.getByText(/^sign-in at/)).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(hadSession()).toBe(false);
  });
});

describe('the session hint', () => {
  it('is set by a session and cleared when the API ends it', async () => {
    await signIn();
    renderAt('/users/7c41ab');
    expect(await screen.findByRole('heading', { name: 'User detail' })).toBeInTheDocument();
    expect(hadSession()).toBe(true);

    // The same ending as the mid-use test above: the session is revoked and
    // the access token has expired, so the next request's refresh answers 401.
    await call('/api/v1/auth/logout', { method: 'POST' });
    advanceClock(901_000);
    await act(async () => {
      await api.GET('/api/v1/roles');
    });

    expect(await screen.findByText(/^sign-in at/)).toBeInTheDocument();
    expect(hadSession()).toBe(false);
  });

  it('holds no token: after sign-in, no storage entry contains the access token', async () => {
    const { accessToken } = await signIn();
    renderAt('/users/7c41ab');
    expect(await screen.findByRole('heading', { name: 'User detail' })).toBeInTheDocument();

    const stored = Object.keys(localStorage).map((key) => localStorage.getItem(key) ?? '');
    expect(stored.some((value) => value.includes(accessToken))).toBe(false);
  });
});
