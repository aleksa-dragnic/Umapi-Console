import { delay } from 'msw';
import { now, takeColdStartDelay } from '@/lib/testing/scenario';

/**
 * Row 52: `auth` is 10 a minute keyed by IP and covers login, refresh and
 * logout; `read` is 100 and `write` 30 a minute keyed by user id. The mock has
 * one client, so its "IP" is a single key. Fixed one-minute windows.
 */
export type Policy = 'auth' | 'read' | 'write';

const LIMITS: Record<Policy, number> = { auth: 10, read: 100, write: 30 };
const WINDOW_MS = 60_000;
// Row 28: `Retry-After: 60`, in seconds.
export const RETRY_AFTER_SECONDS = 60;

const windows = new Map<string, { startedAt: number; count: number }>();

export function resetLimits(): void {
  windows.clear();
}

/** Counts the request, and answers whether it is over the limit. */
export function overLimit(policy: Policy, key: string): boolean {
  const id = `${policy}:${key}`;
  const current = windows.get(id);
  if (!current || now() - current.startedAt >= WINDOW_MS) {
    windows.set(id, { startedAt: now(), count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > LIMITS[policy];
}

// Bridge spec section 1: the request body limit is 256 KB, answered with 413.
export const BODY_LIMIT_BYTES = 256 * 1024;

export async function bodyTooLarge(request: Request): Promise<boolean> {
  const length = request.headers.get('Content-Length');
  if (length !== null) {
    return Number(length) > BODY_LIMIT_BYTES;
  }
  const body = await request.clone().arrayBuffer();
  return body.byteLength > BODY_LIMIT_BYTES;
}

/** Row 35: the first request after a simulated idle period waits. */
export async function coldStart(): Promise<void> {
  const ms = takeColdStartDelay();
  if (ms > 0) {
    await delay(ms);
  }
}
