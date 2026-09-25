import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { RateLimitNotice, rateLimitCopy } from '@/ui/RateLimitNotice';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('RateLimitNotice (inventory section 2.7)', () => {
  test('it counts down once a second and calls back at zero', () => {
    const elapsed = vi.fn();
    render(<RateLimitNotice seconds={2} onElapsed={elapsed} />);

    expect(screen.getByRole('status')).toHaveTextContent(rateLimitCopy(2));

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole('status')).toHaveTextContent('Try again in 1 second.');
    expect(elapsed).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(elapsed).toHaveBeenCalledTimes(1);
  });

  test('the sentence is announced, the ticking number is not', () => {
    render(<RateLimitNotice seconds={42} />);

    expect(screen.getByText('42 seconds')).toHaveAttribute('aria-live', 'off');
  });
});
