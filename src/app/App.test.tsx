import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';

import App from '@/app/App';
import { SessionBoundary } from '@/features/auth';
import { signIn } from '@/lib/testing/support';

describe('App', () => {
  it('renders the application wordmark', async () => {
    await signIn();
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<SessionBoundary />}>
            <Route path="/" element={<App />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'Umapi Console' })).toBeInTheDocument();
  });
});
