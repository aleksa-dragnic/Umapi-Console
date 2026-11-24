import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';

import { DirectoryScreen, USERS_PATH } from '@/features/users/DirectoryScreen';
import { PASSWORD_HINT } from '@/features/users/RegisterUserDialog';
import { setAccessToken } from '@/lib/api/access-token';
import { MOCK_ACCOUNTS, simulateColdStart } from '@/lib/testing/mock';
import { server } from '@/lib/testing/server';
import { signIn, url } from '@/lib/testing/support';
import { UNREACHABLE_COPY } from '@/features/users/Failure';

function Arrived() {
  const location = useLocation();
  return <h1>Detail at {location.pathname}</h1>;
}

async function renderDirectoryAs(account: { email: string; password: string }) {
  setAccessToken((await signIn(account)).accessToken);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[USERS_PATH]}>
        <Routes>
          <Route path={USERS_PATH} element={<DirectoryScreen />} />
          <Route path="/users/:id" element={<Arrived />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Every registration request the mock receives, with the key it carried. */
function registrations(): { keys: (string | null)[] } {
  const seen = { keys: [] as (string | null)[] };
  server.events.on('request:start', ({ request }) => {
    if (request.method === 'POST' && new URL(request.url).pathname === '/api/v1/users') {
      seen.keys.push(request.headers.get('Idempotency-Key'));
    }
  });
  return seen;
}

async function openDialog() {
  await userEvent.click(await screen.findByRole('button', { name: 'Register a user' }));
  return screen.getByRole('dialog', { name: 'Register a user' });
}

async function fill(dialog: HTMLElement, values: Partial<Record<string, string>>) {
  for (const [label, value] of Object.entries(values)) {
    const field = within(dialog).getByLabelText(label);
    await userEvent.clear(field);
    if (value !== undefined && value !== '') await userEvent.type(field, value);
  }
}

const VALID = {
  Email: 'nova.korisnica@example.com',
  'First name': 'Nova',
  'Last name': 'Korisnica',
  Password: 'Dobra-Lozinka-1',
};

afterEach(() => {
  server.events.removeAllListeners();
});

describe('register-user (inventory section 3.13)', () => {
  it('gated: the demo account sees the control disabled, with its reason, and no dialog', async () => {
    await renderDirectoryAs(MOCK_ACCOUNTS.demo);

    const control = await screen.findByRole('button', { name: 'Register a user' });
    expect(control).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText(/users\.write/)).toBeInTheDocument();

    await userEvent.click(control);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('open: four labelled fields, focus on the first, and the password hint linked to its field', async () => {
    await renderDirectoryAs(MOCK_ACCOUNTS.admin);
    const dialog = await openDialog();

    expect(within(dialog).getByLabelText('Email')).toHaveFocus();
    const password = within(dialog).getByLabelText('Password');
    expect(password).toHaveAttribute('type', 'password');
    expect(password).toHaveAttribute('autocomplete', 'new-password');
    expect(password).toHaveAccessibleDescription(PASSWORD_HINT);
  });

  it('invalid before sending: every field says what is wrong, focus goes to the first, nothing is sent', async () => {
    const seen = registrations();
    await renderDirectoryAs(MOCK_ACCOUNTS.admin);
    const dialog = await openDialog();
    await fill(dialog, { Password: 'short' });

    await userEvent.click(within(dialog).getByRole('button', { name: 'Register' }));

    const email = within(dialog).getByLabelText('Email');
    expect(email).toHaveFocus();
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email).toHaveAccessibleDescription('Enter an email address.');
    expect(within(dialog).getByLabelText('First name')).toHaveAccessibleDescription(
      'Enter a first name.',
    );
    // The error first, then the hint: what went wrong, then what is expected.
    expect(within(dialog).getByLabelText('Password')).toHaveAccessibleDescription(
      `At least 8 characters. ${PASSWORD_HINT}`,
    );
    expect(seen.keys).toEqual([]);
  });

  it('a message goes as its field is corrected', async () => {
    await renderDirectoryAs(MOCK_ACCOUNTS.admin);
    const dialog = await openDialog();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Register' }));

    await fill(dialog, { Email: 'a@b.co' });

    expect(within(dialog).getByLabelText('Email')).not.toHaveAttribute('aria-invalid');
  });

  it('registered: the dialog closes, and the detail of the new user opens', async () => {
    const seen = registrations();
    await renderDirectoryAs(MOCK_ACCOUNTS.admin);
    const dialog = await openDialog();
    await fill(dialog, VALID);

    // Enter submits too, through the form attribute; jsdom's user-event does not
    // follow it, so that is checked in the browsers (e2e/register-user.spec.ts).
    await userEvent.click(within(dialog).getByRole('button', { name: 'Register' }));

    expect(
      await screen.findByRole('heading', { name: /^Detail at \/users\// }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(seen.keys).toHaveLength(1);
    expect(seen.keys[0]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('a taken email: the 409 from the API lands on the email field, and focus goes there', async () => {
    await renderDirectoryAs(MOCK_ACCOUNTS.admin);
    const dialog = await openDialog();
    await fill(dialog, { ...VALID, Email: MOCK_ACCOUNTS.demo.email });

    await userEvent.click(within(dialog).getByRole('button', { name: 'Register' }));

    const email = within(dialog).getByLabelText('Email');
    await vi.waitFor(() => expect(email).toHaveAttribute('aria-invalid', 'true'));
    expect(email).toHaveFocus();
    expect(email).toHaveAccessibleDescription('A user with this email already exists.');
  });

  it('no answer, then a retry: the same body goes with the same Idempotency-Key', async () => {
    const seen = registrations();
    server.use(http.post(url('/api/v1/users'), () => HttpResponse.error(), { once: true }));
    await renderDirectoryAs(MOCK_ACCOUNTS.admin);
    const dialog = await openDialog();
    await fill(dialog, VALID);

    await userEvent.click(within(dialog).getByRole('button', { name: 'Register' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(UNREACHABLE_COPY);

    await userEvent.click(within(dialog).getByRole('button', { name: 'Register' }));

    expect(
      await screen.findByRole('heading', { name: /^Detail at \/users\// }),
    ).toBeInTheDocument();
    expect(seen.keys).toHaveLength(2);
    expect(seen.keys[1]).toBe(seen.keys[0]);
  });

  it('a changed body after a failure goes with a new key', async () => {
    const seen = registrations();
    server.use(http.post(url('/api/v1/users'), () => HttpResponse.error(), { once: true }));
    await renderDirectoryAs(MOCK_ACCOUNTS.admin);
    const dialog = await openDialog();
    await fill(dialog, VALID);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Register' }));
    await within(dialog).findByRole('alert');

    await fill(dialog, { 'Last name': 'Promenjena' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Register' }));

    await screen.findByRole('heading', { name: /^Detail at \/users\// });
    expect(seen.keys[1]).not.toBe(seen.keys[0]);
  });

  it('submitting: the fields are read-only and the dialog holds until the answer', async () => {
    await renderDirectoryAs(MOCK_ACCOUNTS.admin);
    const dialog = await openDialog();
    await fill(dialog, VALID);
    simulateColdStart(400);

    await userEvent.click(within(dialog).getByRole('button', { name: 'Register' }));

    expect(within(dialog).getByLabelText('Email')).toHaveAttribute('readonly');
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: 'Register a user' })).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: /^Detail at \/users\// }),
    ).toBeInTheDocument();
  });

  it('cancelled: Escape closes it and focus returns to the control that opened it', async () => {
    await renderDirectoryAs(MOCK_ACCOUNTS.admin);
    await openDialog();

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Register a user' })).toHaveFocus();
  });

  it('Show password reveals what was typed, and says so', async () => {
    await renderDirectoryAs(MOCK_ACCOUNTS.admin);
    const dialog = await openDialog();
    const toggle = within(dialog).getByRole('button', { name: 'Show password' });

    await userEvent.click(toggle);

    expect(within(dialog).getByLabelText('Password')).toHaveAttribute('type', 'text');
    expect(within(dialog).getByRole('button', { name: 'Hide password' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
