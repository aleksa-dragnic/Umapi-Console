import { useState } from 'react';

import { failureOf } from '@/features/users/api';
import { Button } from '@/ui/Button';
import { RateLimitNotice } from '@/ui/RateLimitNotice';

/**
 * A read that produced nothing to show, for the directory and the detail alike
 * (inventory sections 2.7 and 2.8): the status and the title, the `traceId`
 * when the body carried one, and Retry, which refetches rather than reloading.
 * A 429 holds Retry until `Retry-After` has passed. A request nothing answered
 * says so.
 */

export const UNREACHABLE_COPY = 'No response from the API.';

export function Failure({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const [elapsedFor, setElapsedFor] = useState<unknown>(null);
  const failure = failureOf(error);

  if (failure.kind === 'unreachable') {
    return (
      <div role="alert" className="flex flex-col items-start gap-app-2 p-app-3">
        <p className="text-fg-primary">{UNREACHABLE_COPY}</p>
        <Button onClick={onRetry}>Retry</Button>
      </div>
    );
  }

  const { problem } = failure;
  const limited = problem.status === 429 && elapsedFor !== error;
  return (
    <div role="alert" className="flex flex-col items-start gap-app-2 p-app-3">
      <p className="text-fg-primary">
        <span className="font-mono">{problem.status}</span> {problem.title}
      </p>
      {problem.traceId === undefined ? null : (
        <p className="font-mono text-app-meta text-fg-secondary">{problem.traceId}</p>
      )}
      <Button
        onClick={onRetry}
        disabledReason={
          limited ? (
            <RateLimitNotice
              seconds={failure.retryAfterSeconds}
              onElapsed={() => setElapsedFor(error)}
            />
          ) : undefined
        }
      >
        Retry
      </Button>
    </div>
  );
}
