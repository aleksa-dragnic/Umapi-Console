import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';

import { RequireSession } from '@/features/auth/RequireSession';
import { SessionBoundary } from '@/features/auth/SessionBoundary';
import { SignInScreen } from '@/features/auth/SignInScreen';
import { SignOutButton } from '@/features/auth/SignOutButton';
import { SIGN_IN_PATH } from '@/features/auth/next';
import { currentAccessToken } from '@/lib/api/access-token';
import { call, json, refresh, signIn } from '@/lib/testing/support';

function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.pathname + location.search}</p>;
}

async function renderSignedIn() {
  await signIn();
  render(
    <MemoryRouter initialEntries={['/users/7c41ab']}>
      <Routes>
        <Route element={<SessionBoundary />}>
          <Route path={SIGN_IN_PATH} element={<SignInScreen />} />
          <Route element={<RequireSession />}>
            <Route
              path="*"
              element={
                <main>
                  <h1>Signed in</h1>
                  <SignOutButton />
                </main>
              }
            />
          </Route>
        </Route>
      </Routes>
      <Where />
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { name: 'Signed in' });
}

describe('sign out', () => {
  it('tells the API, forgets the session and shows sign-in with no banner and no next', async () => {
    await renderSignedIn();

    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent(new RegExp(`^${SIGN_IN_PATH}$`));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(currentAccessToken()).toBeNull();
    // Row 54: the API revoked the token and cleared the cookie.
    expect((await refresh()).status).toBe(401);
  });

  it('forgets the session even when the API refuses the sign-out (row 52)', async () => {
    await renderSignedIn();
    // Sign-in and the boot refresh spent two of the ten; the sign-out comes after ten more.
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await call('/api/v1/auth/login', {
        method: 'POST',
        ...json({ email: 'nobody@example.org', password: 'x' }),
      });
    }

    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(currentAccessToken()).toBeNull();
  });
});
