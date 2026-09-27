import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';

import { INSPECTOR_POINTER_COPY } from '@/features/users/DirectoryScreen';
import { READ_ONLY_COPY, RolesScreen } from '@/features/users/RolesScreen';
import { setAccessToken } from '@/lib/api/access-token';
import { server } from '@/lib/testing/server';
import { signIn, url } from '@/lib/testing/support';

async function renderRoles() {
  setAccessToken((await signIn()).accessToken);
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <RolesScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('the roles screen (inventory section 3.7)', () => {
  it('ready: each role with its permissions as badges, and says it is read-only', async () => {
    await renderRoles();

    expect(screen.getByText(READ_ONLY_COPY)).toBeInTheDocument();
    const administrator = await screen.findByRole('list', { name: 'Administrator permissions' });
    expect(within(administrator).getByText('roles.manage')).toBeInTheDocument();
    const member = screen.getByRole('list', { name: 'Member permissions' });
    expect(within(member).queryByText('users.write')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('loading: skeleton rows under the header until the roles arrive', async () => {
    await renderRoles();

    expect(screen.getByRole('columnheader', { name: 'Permissions' })).toBeInTheDocument();
    expect(screen.queryByRole('cell')).not.toBeInTheDocument();
    expect(await screen.findByRole('cell', { name: 'Administrator' })).toBeInTheDocument();
  });

  it('error: the status and title in place of the table, the way to the inspector, and Retry (section 2.8)', async () => {
    server.use(
      http.get(
        url('/api/v1/roles'),
        () =>
          HttpResponse.json(
            { status: 503, title: 'Service Unavailable' },
            { status: 503, headers: { 'Content-Type': 'application/problem+json' } },
          ),
        { once: true },
      ),
    );
    await renderRoles();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('503 Service Unavailable');
    expect(alert).toHaveTextContent(INSPECTOR_POINTER_COPY);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
