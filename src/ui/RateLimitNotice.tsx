import { useEffect, useEffectEvent, useState } from 'react';

/**
 * The `rate-limited` state (screen inventory section 2.7): the wait a 429 asked
 * for, counting down to zero. The sentence is announced once; the number that
 * ticks inside it is not, or a screen reader would read every second aloud.
 *
 * It renders as inline content so it can sit inside a control's stated reason.
 * A new 429 is a new countdown: give the element a new `key`.
 */

export interface RateLimitNoticeProps {
  /** From `Retry-After`, already defaulted - see `retryAfterSeconds`. */
  seconds: number;
  /** Called once, when the count reaches zero. */
  onElapsed?: (() => void) | undefined;
}

export function rateLimitCopy(seconds: number): string {
  return `Too many attempts. Try again in ${seconds} ${seconds === 1 ? 'second' : 'seconds'}.`;
}

export function RateLimitNotice({ seconds, onElapsed }: RateLimitNoticeProps) {
  const [left, setLeft] = useState(Math.max(0, seconds));
  const elapsed = useEffectEvent(() => onElapsed?.());

  useEffect(() => {
    if (left <= 0) {
      elapsed();
      return;
    }
    const timer = setTimeout(() => setLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [left]);

  return (
    <span role="status" className="font-mono text-app-meta text-fg-secondary">
      Too many attempts. Try again in{' '}
      <span aria-live="off" className="tabular-nums">
        {left} {left === 1 ? 'second' : 'seconds'}
      </span>
      .
    </span>
  );
}
