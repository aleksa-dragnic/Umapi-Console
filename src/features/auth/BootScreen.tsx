import { describeFailure } from '@/features/auth/api';
import type { SessionState } from '@/features/auth/session';
import { AppMark } from '@/ui/AppMark';
import { Button } from '@/ui/Button';
import { COLD_START_AFTER_MS, ColdStartNotice } from '@/ui/ColdStartNotice';
import { RateLimitNotice } from '@/ui/RateLimitNotice';
import { StatusDot } from '@/ui/StatusDot';
import { useAfter } from '@/ui/useAfter';

/**
 * The `boot` screen (inventory section 3.1): what renders while the console
 * asks the API whether a session exists, so a signed-in user reloading a deep
 * route never sees the sign-in form. The mark on black and nothing else; a
 * pending dot from 400 ms; the cold-start line from 1200 ms.
 */

export const PENDING_AFTER_MS = 400;

export type BootState = Exclude<SessionState, { status: 'authenticated' | 'anonymous' }>;

export interface BootScreenProps {
  state: BootState;
  onRetry: () => void;
}

export function BootScreen({ state, onRetry }: BootScreenProps) {
  const checking = state.status === 'checking';
  const pending = useAfter(PENDING_AFTER_MS, checking);
  const slow = useAfter(COLD_START_AFTER_MS, checking);

  return (
    <main
      aria-label="Checking the session"
      aria-busy={checking ? true : undefined}
      className="flex min-h-screen flex-col items-center justify-center gap-app-4 p-app-3"
    >
      <AppMark size="lg" />

      {pending && !slow ? <StatusDot /> : null}

      <div className="max-w-md">
        <ColdStartNotice pending={checking} />
      </div>

      {state.status === 'rate-limited' ? (
        <RateLimitNotice seconds={state.retryAfterSeconds} onElapsed={onRetry} />
      ) : null}

      {state.status === 'unavailable' ? (
        <div role="alert" className="flex max-w-md flex-col items-center gap-app-2 text-center">
          <p className="text-fg-primary">The console could not check your session.</p>
          <p className="font-mono text-app-meta text-fg-secondary">
            {describeFailure(state.failure)}
          </p>
          <Button onClick={onRetry}>Retry</Button>
        </div>
      ) : null}
    </main>
  );
}
