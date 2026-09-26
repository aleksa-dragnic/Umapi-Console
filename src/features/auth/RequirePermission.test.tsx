import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';

import { GATED_ROUTE_HEADING, RequirePermission } from '@/features/auth/RequirePermission';
import { setAccessToken } from '@/lib/api/access-token';
import { MOCK_ACCOUNTS } from '@/lib/testing/mock';
import { signIn } from '@/lib/testing/support';

async function renderAs(account: { email: string; password: string }) {
  setAccessToken((await signIn(account)).accessToken);
  render(
    <MemoryRouter initialEntries={['/roles/new']}>
      <Routes>
        <Route element={<RequirePermission permission="roles.manage" />}>
          <Route path="/roles/new" element={<h1>New role</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('a route that needs a permission (inventory section 2.6)', () => {
  it('states the reason in place for an account without it', async () => {
    await renderAs(MOCK_ACCOUNTS.demo);

    expect(screen.getByRole('heading', { name: GATED_ROUTE_HEADING })).toBeInTheDocument();
    expect(
      screen.getByText('Requires roles.manage. This account holds users.read, roles.read.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'New role' })).not.toBeInTheDocument();
  });

  it('renders the route for an account that holds it', async () => {
    await renderAs(MOCK_ACCOUNTS.admin);

    expect(screen.getByRole('heading', { name: 'New role' })).toBeInTheDocument();
  });
});
