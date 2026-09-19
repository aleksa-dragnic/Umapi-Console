import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { CodeWindow } from '@/ui/CodeWindow';

describe('CodeWindow', () => {
  test('renders its body verbatim', () => {
    render(<CodeWindow>{'{ "status": 409 }'}</CodeWindow>);

    expect(screen.getByText('{ "status": 409 }')).toBeInTheDocument();
  });

  test('renders its caption', () => {
    render(<CodeWindow title="GET /api/v1/users">{'[]'}</CodeWindow>);

    expect(screen.getByText('GET /api/v1/users')).toBeInTheDocument();
  });

  test('a truncated body says so rather than looking short', () => {
    render(<CodeWindow truncatedAtKb={64}>{'[]'}</CodeWindow>);

    expect(screen.getByText('Response truncated at 64 kB.')).toBeInTheDocument();
  });
});