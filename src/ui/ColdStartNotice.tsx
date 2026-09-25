import { StatusDot } from '@/ui/StatusDot';
import { useAfter } from '@/ui/useAfter';

/**
 * The `cold-start` state (screen inventory section 2.1). The API runs on a free
 * instance that sleeps; its first answer after idle took about half a minute
 * (observed row 35), and a stopped database stretched readiness to 56 s (row
 * 37), which is why the copy promises a minute. Rendered beneath the screen's
 * own loading state once a request has been pending for 1200 ms, with a pending
 * dot rather than a spinner that implies the wait is nearly over.
 */

export const COLD_START_AFTER_MS = 1200;

export const COLD_START_COPY =
  'Waking the API. The demo runs on a free instance that sleeps when idle — this can take up to a minute.';

export interface ColdStartNoticeProps {
  /** A request is in flight. */
  pending: boolean;
  /** How long it must stay pending first. The specimen page passes 0. */
  afterMs?: number | undefined;
}

export function ColdStartNotice({ pending, afterMs = COLD_START_AFTER_MS }: ColdStartNoticeProps) {
  const slow = useAfter(afterMs, pending);
  if (!slow) return null;

  return (
    <p role="status" className="flex items-start gap-app-1 font-mono text-app-meta text-fg-muted">
      <StatusDot className="shrink-0" />
      <span>{COLD_START_COPY}</span>
    </p>
  );
}
