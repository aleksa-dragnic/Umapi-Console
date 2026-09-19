import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { Card } from '@/ui/Card';

describe('Card', () => {
  test('renders its content', () => {
    render(<Card>Roles are seeded by the API and are read-only in v1.</Card>);

    expect(
      screen.getByText('Roles are seeded by the API and are read-only in v1.'),
    ).toBeInTheDocument();
  });

  test('a titled card is a region named by its heading', () => {
    render(<Card title="Concurrency">ETag</Card>);

    expect(screen.getByRole('heading', { name: 'Concurrency' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Concurrency' })).toBeInTheDocument();
  });
});