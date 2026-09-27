import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import { AppRoutes } from '@/app/AppRoutes';
import { MOCK_ACCOUNTS } from '@/lib/testing/mock';
import { signIn } from '@/lib/testing/support';

describe('AppRoutes', () => {
  it('sends an anonymous visitor at the root path to sign-in', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('renders the application at the root path once the refresh cookie restores the session', async () => {
    await signIn();
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Umapi Console' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sign in' })).not.toBeInTheDocument();
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
