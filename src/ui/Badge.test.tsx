import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { Badge } from '@/ui/Badge';

describe('Badge', () => {
  test('renders its text', () => {
    render(<Badge>users.read</Badge>);

    expect(screen.getByText('users.read')).toBeInTheDocument();
  });

  test('it is data, not status, so it carries no role', () => {
    // A badge names a permission or a role from the API's seed. Giving it a
    // status role would make assistive technology announce it as state.
    render(<Badge>roles.read</Badge>);

    expect(screen.getByText('roles.read')).not.toHaveAttribute('role');
  });
});