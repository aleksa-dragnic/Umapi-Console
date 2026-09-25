import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';

import { RequireSession } from '@/features/auth/RequireSession';
import { SessionBoundary } from '@/features/auth/SessionBoundary';
import {
  ACCOUNT_LOCKED_COPY,
  INVALID_CREDENTIALS_COPY,
  SignInScreen,
} from '@/features/auth/SignInScreen';
import { SIGN_IN_PATH } from '@/features/auth/next';
import { api } from '@/lib/api/client';
import { DEMO_ACCOUNT } from '@/lib/api/demo-account';
import { buildUsers } from '@/lib/testing/factories';
import { MOCK_ACCOUNTS, SYNTHETIC_PASSWORD, simulateColdStart } from '@/lib/testing/mock';
import { server } from '@/lib/testing/server';
import { call, json, signIn } from '@/lib/testing/support';
import { COLD_START_COPY } from '@/ui/ColdStartNotice';
import { rateLimitCopy } from '@/ui/RateLimitNotice';

function Destination() {
  const location = useLocation();
  return <h1>Arrived at {location.pathname}</h1>;
}

async function renderSignIn(path = SIGN_IN_PATH) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<SessionBoundary />}>
          <Route path={SIGN_IN_PATH} element={<SignInScreen />} />
          <Route element={<RequireSession />}>
            <Route path="*" element={<Destination />} />
          </Route>
        </Route>
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { name: 'Sign in' });
}

async function submit(email: string, password: string) {
  const user = userEvent.setup();
  if (email !== '') await user.type(screen.getByLabelText('Email'), email);
  if (password !== '') await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
}

afterEach(() => {
  server.events.removeAllListeners();
});

describe('sign-in (inventory section 3.2)', () => {
  it('prints the demo account below the form', async () => {
    await renderSignIn();

    expect(screen.getByRole('form', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByText(DEMO_ACCOUNT.email)).toBeInTheDocument();
    expect(screen.getByText(DEMO_ACCOUNT.password)).toBeInTheDocument();
  });

  it('signs in and continues to the page that was asked for', async () => {
    await renderSignIn(`${SIGN_IN_PATH}?next=${encodeURIComponent('/users/7c41ab')}`);
    await submit(DEMO_ACCOUNT.email, DEMO_ACCOUNT.password);

    expect(
      await screen.findByRole('heading', { name: 'Arrived at /users/7c41ab' }),
    ).toBeInTheDocument();
  });

  it('ignores a next that points at another origin', async () => {
    await renderSignIn(`${SIGN_IN_PATH}?next=${encodeURIComponent('//evil.example/steal')}`);
    await submit(DEMO_ACCOUNT.email, DEMO_ACCOUNT.password);

    expect(await screen.findByRole('heading', { name: 'Arrived at /' })).toBeInTheDocument();
  });

  it('sends a signed-in user on instead of showing the form', async () => {
    await signIn();
    render(
      <MemoryRouter initialEntries={[SIGN_IN_PATH]}>
        <Routes>
          <Route element={<SessionBoundary />}>
            <Route path={SIGN_IN_PATH} element={<SignInScreen />} />
            <Route path="*" element={<Destination />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Arrived at /' })).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Sign in' })).not.toBeInTheDocument();
  });

  it('keeps the fields read-only and the button busy while submitting, and says when the API is waking', async () => {
    await renderSignIn();
    simulateColdStart(1500);
    await submit(DEMO_ACCOUNT.email, DEMO_ACCOUNT.password);

    expect(screen.getByLabelText('Email')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Password')).toHaveAttribute('readonly');
    expect(screen.getByRole('button', { name: 'Sign in' })).toHaveAttribute('aria-busy', 'true');
    expect(await screen.findByText(COLD_START_COPY, {}, { timeout: 4000 })).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'Arrived at /' }, { timeout: 4000 }),
    ).toBeInTheDocument();
  });

  it('puts 422 field messages under their fields and focuses the first (observed row 19)', async () => {
    await renderSignIn();
    await submit('', '');

    const email = screen.getByLabelText('Email');
    await waitFor(() => expect(email).toHaveAttribute('aria-invalid', 'true'));
    expect(screen.getByText("'Email' must not be empty.")).toBeInTheDocument();
    expect(screen.getByText("'Password' must not be empty.")).toBeInTheDocument();
    expect(email).toHaveFocus();
  });

  it('answers a wrong password and an unknown email with the same message (observed row 5)', async () => {
    await renderSignIn();
    await submit(DEMO_ACCOUNT.email, 'wrong-password');
    expect(await screen.findByRole('alert')).toHaveTextContent(INVALID_CREDENTIALS_COPY);

    await userEvent.clear(screen.getByLabelText('Email'));
    await submit('nobody@example.org', '');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Sign in' })).not.toHaveAttribute('aria-busy'),
    );
    expect(screen.getByRole('alert')).toHaveTextContent(INVALID_CREDENTIALS_COPY);
  });

  it('says so when the account is locked', async () => {
    const locked = buildUsers().find((user) => user.status === 'Locked');
    await renderSignIn();
    await submit(locked?.email ?? '', SYNTHETIC_PASSWORD);

    expect(await screen.findByRole('alert')).toHaveTextContent(ACCOUNT_LOCKED_COPY);
  });

  it('counts down a 429 and holds the submit control until it ends (observed row 28)', async () => {
    await renderSignIn();
    // The boot refresh spent one of the ten; nine more, and the submit is the eleventh.
    for (let attempt = 0; attempt < 9; attempt += 1) {
      await call('/api/v1/auth/login', {
        method: 'POST',
        ...json({ email: 'nobody@example.org', password: 'x' }),
      });
    }
    await submit(DEMO_ACCOUNT.email, DEMO_ACCOUNT.password);

    expect(await screen.findByRole('status')).toHaveTextContent(rateLimitCopy(60));
    expect(screen.getByRole('button', { name: 'Sign in' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('keeps the access token in memory: the client sends it, and no storage holds it', async () => {
    const authorizations: string[] = [];
    server.events.on('request:start', ({ request }) => {
      const header = request.headers.get('Authorization');
      if (header !== null) authorizations.push(header);
    });
    await renderSignIn();
    await submit(MOCK_ACCOUNTS.admin.email, MOCK_ACCOUNTS.admin.password);
    await screen.findByRole('heading', { name: 'Arrived at /' });

    const { response } = await api.GET('/api/v1/roles');

    expect(response.status).toBe(200);
    const token = authorizations[0]?.replace(/^Bearer /, '') ?? '';
    expect(token).not.toBe('');
    // MSW keeps its own cookie jar in localStorage; the token must be in neither store.
    for (const storage of [localStorage, sessionStorage]) {
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index) ?? '';
        expect(`${key}=${storage.getItem(key) ?? ''}`).not.toContain(token);
      }
    }
  });
});
