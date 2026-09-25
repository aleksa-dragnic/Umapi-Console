import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { COLD_START_AFTER_MS, COLD_START_COPY, ColdStartNotice } from '@/ui/ColdStartNotice';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ColdStartNotice (inventory section 2.1)', () => {
  test('nothing shows before the threshold, the copy and a pending dot after it', () => {
    render(<ColdStartNotice pending />);

    act(() => {
      vi.advanceTimersByTime(COLD_START_AFTER_MS - 1);
    });
    expect(screen.queryByText(COLD_START_COPY)).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByText(COLD_START_COPY)).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();
  });

  test('it disappears as soon as the request settles', () => {
    const { rerender } = render(<ColdStartNotice pending />);
    act(() => {
      vi.advanceTimersByTime(COLD_START_AFTER_MS);
    });

    rerender(<ColdStartNotice pending={false} />);

    expect(screen.queryByText(COLD_START_COPY)).not.toBeInTheDocument();
  });
});
