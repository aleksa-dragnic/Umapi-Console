import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';

import { RequireSession } from '@/features/auth/RequireSession';
import { SessionBoundary } from '@/features/auth/SessionBoundary';
import {
  CONFIRM_COPY,
  EXPIRED_COPY,
  RACED_COPY,
  RACE_EXPLANATION,
  SESSION_PATH,
  SessionScreen,
} from '@/features/auth/SessionScreen';
import { SESSION_ENDED_COPY, SignInScreen } from '@/features/auth/SignInScreen';
import { SIGN_IN_PATH } from '@/features/auth/next';
import { currentAccessToken } from '@/lib/api/access-token';
import { advanceClock, setRefreshRace } from '@/lib/testing/mock';
import { call, json, signIn } from '@/lib/testing/support';

function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.pathname + location.search}</p>;
}

async function renderSession() {
  await signIn();
  render(
    <MemoryRouter initialEntries={[SESSION_PATH]}>
      <Routes>
        <Route element={<SessionBoundary />}>
          <Route path={SIGN_IN_PATH} element={<SignInScreen />} />
          <Route element={<RequireSession />}>
            <Route path={SESSION_PATH} element={<SessionScreen />} />
          </Route>
        </Route>
      </Routes>
      <Where />
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { name: 'Session' });
}

async function race() {
  await userEvent.click(screen.getByRole('button', { name: 'Race two refreshes' }));
  await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('the session screen (inventory section 3.9)', () => {
  it('counts fifteen minutes down from arrival, whatever the server and client clocks say (Gate 3, row 40)', async () => {
    // The server's clock ten minutes behind the client's when the token is issued...
    advanceClock(-600_000);
    await renderSession();
    // ...and the client's clock jumping ten minutes forward once it has arrived.
    vi.setSystemTime(Date.now() + 600_000);

    // Compared with the client clock, exp would lie five minutes in the past.
    expect(screen.getByText(/^Expires in/)).toHaveTextContent(/^Expires in (15:00|14:59)\.$/);
    expect(
      screen.getByText(
        'Counted from the moment it arrived: exp - iat is 900 s. The client clock is not consulted.',
      ),
    ).toBeInTheDocument();
  });

  it('says the token has expired once its lifetime is spent', async () => {
    await renderSession();
    const real = performance.now.bind(performance);
    vi.spyOn(performance, 'now').mockImplementation(() => real() + 900_000);

    expect(await screen.findByText(EXPIRED_COPY, {}, { timeout: 2_000 })).toBeInTheDocument();
  });

  it('lists the claims the token carries', async () => {
    await renderSession();

    const table = screen.getByRole('table', { name: 'Access token claims' });
    const permission = within(table).getByRole('row', { name: /^permission/ });
    expect(permission).toHaveTextContent(/users\.read/);
    expect(permission).toHaveTextContent(/roles\.read/);
    expect(within(table).getByRole('row', { name: /^email/ })).toHaveTextContent(
      'demo@umapi.local',
    );
  });

  it('explains both outcomes, and asks before racing, starting on Cancel', async () => {
    await renderSession();
    expect(screen.getByText(RACE_EXPLANATION)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Race two refreshes' }));

    expect(screen.getByText(CONFIRM_COPY)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText(CONFIRM_COPY)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Race two refreshes' })).toHaveFocus();
  });

  it('raced: lists both answers, says nothing was revoked, and the session continues', async () => {
    await renderSession();
    const before = currentAccessToken();

    await race();

    expect(await screen.findByRole('status')).toHaveTextContent(RACED_COPY);
    expect(screen.getByText(/^Request [12]: 409 Concurrency\.Conflict$/)).toBeInTheDocument();
    expect(screen.getByText(/^Request [12]: 200, with a new access token$/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Session' })).toBeInTheDocument();
    expect(currentAccessToken()).not.toBe(before);
    expect(screen.getByRole('button', { name: 'Race again' })).toBeInTheDocument();
  });

  it('revoked: ends the session at once and signs in again with the reuse wording', async () => {
    await renderSession();
    setRefreshRace('reuse');

    await race();

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(SESSION_ENDED_COPY.reused);
    expect(screen.getByTestId('where')).toHaveTextContent(
      `${SIGN_IN_PATH}?next=${encodeURIComponent(SESSION_PATH)}`,
    );
    expect(currentAccessToken()).toBeNull();
  });

  it('unexpected: states the pair as it arrived', async () => {
    await renderSession();
    // Sign-in and the boot refresh spent two of the ten a minute (row 52).
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await call('/api/v1/auth/login', {
        method: 'POST',
        ...json({ email: 'nobody@example.org', password: 'x' }),
      });
    }

    await race();

    expect(await screen.findByRole('status')).toHaveTextContent(
      'The API answered 429 Too Many Requests and 429 Too Many Requests.',
    );
    expect(screen.getByRole('heading', { name: 'Session' })).toBeInTheDocument();
  });
});
