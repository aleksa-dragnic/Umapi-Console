import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { StatusDot } from '@/ui/StatusDot';

describe('StatusDot', () => {
  test('the numeric code is always shown, so colour is never alone', () => {
    render(<StatusDot status={200} />);

    expect(screen.getByText('200')).toBeInTheDocument();
  });

  test.each([
    [200, 'success'],
    [304, 'redirection'],
    [422, 'client error'],
    [503, 'server error'],
  ])('%i is announced as %s', (status, meaning) => {
    render(<StatusDot status={status} />);

    expect(screen.getByText(meaning)).toBeInTheDocument();
  });

  test('a request in flight has no code yet and says so', () => {
    render(<StatusDot />);

    expect(screen.getByText('pending')).toBeInTheDocument();
  });
});