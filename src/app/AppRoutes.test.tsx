import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import { AppRoutes } from '@/app/AppRoutes';

describe('AppRoutes', () => {
  it('renders the application at the root path', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Umapi Console' })).toBeInTheDocument();
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
