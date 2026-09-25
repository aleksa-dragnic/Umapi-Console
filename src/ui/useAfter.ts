import { useEffect, useState } from 'react';

/**
 * True once `active` has held for `ms` without interruption; false again as
 * soon as it stops. The screen inventory's thresholds are written this way:
 * nothing before 400 ms, the cold-start line after 1200 ms (sections 2.1, 3.1).
 */
export function useAfter(ms: number, active: boolean): boolean {
  const [elapsed, setElapsed] = useState(false);

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setElapsed(true), ms);
    return () => {
      clearTimeout(timer);
      setElapsed(false);
    };
  }, [ms, active]);

  return active && elapsed;
}
