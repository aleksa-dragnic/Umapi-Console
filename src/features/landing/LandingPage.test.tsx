import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import { AUTHOR, LANDING_TITLE, LandingPage } from '@/features/landing/LandingPage';

// Inventory section 3.14 (ADR 0018): what the page says and where it leads.

function renderLanding(label = 'Try the demo', to = '/sign-in') {
  render(
    <MemoryRouter>
      <LandingPage action={{ label, to }} />
    </MemoryRouter>,
  );
}

describe('the landing page (inventory section 3.14)', () => {
  it('says what the console is, and leads to the action it is given', () => {
    renderLanding('Open console', '/users');

    expect(screen.getByRole('heading', { level: 1, name: LANDING_TITLE })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open console' })).toHaveAttribute('href', '/users');
    expect(screen.getByRole('link', { name: 'Read the code' })).toHaveAttribute(
      'href',
      'https://github.com/aleksa-dragnic/Umapi-Console',
    );
  });

  it('links both repositories and names its author', () => {
    renderLanding();

    const source = screen.getByRole('navigation', { name: 'Source code' });
    expect(within(source).getByRole('link', { name: 'API' })).toHaveAttribute(
      'href',
      'https://github.com/aleksa-dragnic/UserManagementAPI',
    );
    expect(screen.getByRole('link', { name: AUTHOR })).toHaveAttribute(
      'href',
      'https://github.com/aleksa-dragnic',
    );
  });

  it('shows the directory with its size known, and the three features', () => {
    renderLanding();

    const screenshot = screen.getByRole('img', { name: /user directory/ });
    expect(screenshot).toHaveAttribute('width', '1440');
    expect(screenshot).toHaveAttribute('height', '900');
    const features = screen.getByRole('region', { name: 'What it makes visible' });
    expect(within(features).getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByRole('region', { name: 'On the wire' })).toHaveTextContent(
      '304 Not Modified',
    );
  });
});
