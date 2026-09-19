import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import { Button } from '@/ui/Button';

describe('Button', () => {
  test('renders its label', () => {
    render(<Button>Assign role</Button>);

    expect(screen.getByRole('button', { name: 'Assign role' })).toBeInTheDocument();
  });

  test('activating it calls the handler', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Assign role</Button>);

    await userEvent.click(screen.getByRole('button', { name: 'Assign role' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test('a gated action states why it is unavailable', () => {
    render(<Button disabledReason="Requires users.write.">Lock user</Button>);

    expect(screen.getByText('Requires users.write.')).toBeInTheDocument();
  });

  test('a gated action is disabled and never fires', async () => {
    const onClick = vi.fn();
    render(
      <Button disabledReason="Requires users.write." onClick={onClick}>
        Lock user
      </Button>,
    );

    const control = screen.getByRole('button', { name: 'Lock user' });
    expect(control).toHaveAttribute('aria-disabled', 'true');

    await userEvent.click(control);

    expect(onClick).not.toHaveBeenCalled();
  });

  test('the reason is announced together with the control', () => {
    render(<Button disabledReason="Requires users.write.">Lock user</Button>);

    expect(screen.getByRole('button', { name: 'Lock user' })).toHaveAccessibleDescription(
      'Requires users.write.',
    );
  });

  test('a pending action is busy and refuses a second activation', async () => {
    const onClick = vi.fn();
    render(
      <Button pending onClick={onClick}>
        Sign in
      </Button>,
    );

    const control = screen.getByRole('button', { name: 'Sign in' });
    expect(control).toHaveAttribute('aria-busy', 'true');

    await userEvent.click(control);

    expect(onClick).not.toHaveBeenCalled();
  });
});