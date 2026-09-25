import { StrictMode, useEffect } from 'react';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';

import { RequireSession } from '@/features/auth/RequireSession';
import { SessionBoundary } from '@/features/auth/SessionBoundary';
import { SIGN_IN_PATH } from '@/features/auth/next';
import { api } from '@/lib/api/client';
import { advanceClock, simulateColdStart } from '@/lib/testing/mock';
import { server } from '@/lib/testing/server';
import { call, signIn } from '@/lib/testing/support';
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
    renderAt('/users/7c41ab');

    expect(await screen.findByRole('status')).toHaveTextContent(rateLimitCopy(60));
    expect(signInMounts.count).toBe(0);
  });
});
