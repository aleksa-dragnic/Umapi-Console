import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';

import { Input } from '@/ui/Input';

describe('Input', () => {
  test('the label names the field', () => {
    render(<Input label="Email" />);

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  test('it accepts typed text', async () => {
    render(<Input label="Email" />);

    await userEvent.type(screen.getByLabelText('Email'), 'marko@example.com');

    expect(screen.getByLabelText('Email')).toHaveValue('marko@example.com');
  });

  test('a field error is shown', () => {
    render(<Input label="Email" error="Email is not a valid address." />);

    expect(screen.getByText('Email is not a valid address.')).toBeInTheDocument();
  });

  test('an invalid field is marked and described by its error', () => {
    render(<Input label="Email" error="Email is not a valid address." />);

    const field = screen.getByLabelText('Email');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription('Email is not a valid address.');
  });
});