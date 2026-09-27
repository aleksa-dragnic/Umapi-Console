import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';

import { AppRoutes } from '@/app/AppRoutes';
import { NOT_FOUND_HEADING } from '@/app/NotFound';
import { MOCK_ACCOUNTS } from '@/lib/testing/mock';
import { signIn } from '@/lib/testing/support';

function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.pathname}</p>;
}

describe('AppRoutes', () => {
  it('sends an anonymous visitor at the root path to sign-in', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('takes a signed-in user at the root path to the directory (build plan decision 1)', async () => {
    await signIn();
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
        <Where />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Users' })).toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/users$/);
  });

  it('renders the read-only roles for an account that holds roles.read', async () => {
    await signIn();
    render(
      <MemoryRouter initialEntries={['/roles']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Roles' })).toBeInTheDocument();
    expect(await screen.findByRole('cell', { name: 'Administrator' })).toBeInTheDocument();
  });

  it('404: an address nothing matches names itself and offers sign-in to a visitor without a session', async () => {
    render(
      <MemoryRouter initialEntries={['/nowhere/at-all']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: NOT_FOUND_HEADING })).toBeInTheDocument();
    expect(screen.getByText('/nowhere/at-all')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in');
    expect(screen.queryByRole('region', { name: 'Inspector' })).not.toBeInTheDocument();
  });

  it('404: offers the directory to a signed-in user', async () => {
    await signIn();
    render(
      <MemoryRouter initialEntries={['/nowhere']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: NOT_FOUND_HEADING })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the directory' })).toHaveAttribute(
      'href',
      '/users',
    );
  });

  it('renders the session screen for a signed-in user', async () => {
    await signIn();
    render(
      <MemoryRouter initialEntries={['/session']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Session' })).toBeInTheDocument();
  });

  it('renders the directory for an account that holds users.read', async () => {
    await signIn();
    render(
      <MemoryRouter initialEntries={['/users']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Users' })).toBeInTheDocument();
    expect(await screen.findByText('200 · 130 results')).toBeInTheDocument();
  });

  it("renders a user's detail at its own address", async () => {
    await signIn();
    render(
      <MemoryRouter initialEntries={[`/users/${MOCK_ACCOUNTS.demo.id}`]}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: MOCK_ACCOUNTS.demo.email }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: 'Concurrency' })).toHaveTextContent('W/');
  });

  it('docks the inspector beneath every screen behind the login, and not beneath sign-in', async () => {
    render(
      <MemoryRouter initialEntries={['/session']}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Inspector' })).not.toBeInTheDocument();
    cleanup();

    await signIn();
    render(
      <MemoryRouter initialEntries={['/session']}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'Session' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Inspector' })).toBeInTheDocument();
  });

  it('serves the specimen route in development', async () => {
    render(
      <MemoryRouter initialEntries={['/_design']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Design specimen' })).toBeInTheDocument();
  });
});
