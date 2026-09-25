import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import { AppRoutes } from '@/app/AppRoutes';
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

  it('serves the specimen route in development', async () => {
    render(
      <MemoryRouter initialEntries={['/_design']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Design specimen' })).toBeInTheDocument();
  });
});
