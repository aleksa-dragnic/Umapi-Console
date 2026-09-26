import { useEffect, useRef, useState } from 'react';

import { raceRefreshes, type RaceOutcome, type RacePair } from '@/features/auth/race';
import { useAccessToken, type HeldAccessToken } from '@/lib/api/access-token';
import { decodeClaims } from '@/lib/api/claims';
import { formatRemaining, remainingSeconds } from '@/lib/api/expiry';
import type { AuthResult } from '@/lib/api/refresh';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/ui/Table';

/**
 * The `session` screen (inventory section 3.9): the access token's expiry and
 * claims, and the reuse demonstration. Application density. Every state is a
 * row of that table and the copy is the inventory's.
 *
 * The demonstration is not gated (decision 5): it is available to the demo
 * account, and the confirmation says what it may do to everyone else on it.
 * `revoked` is never drawn here - the session ends, and `RequireSession` takes
 * the user to sign-in, where the reuse wording is shown (section 2.4). Both
 * responses are listed on this screen until the inspector arrives in PR 15.
 */

export const SESSION_PATH = '/session';

export const EXPIRED_COPY = 'Expired. The next request will refresh it.';

export const RACE_EXPLANATION =
  'Sends two refresh requests at the same moment with the same cookie - the mistake single-flight exists to prevent. The API lets one through and refuses the other, in one of two ways. A 409 means the second request collided with the write of the first: nothing is revoked, and your session continues. A 401 means it read the token after the first had rotated it, which looks exactly like a stolen token: every session of this account is revoked.';

export const CONFIRM_COPY =
  'If the API treats the second request as a replay, it ends your session and every other session of this account. The demo account is shared: anyone else signed in as demo would be signed out at their next refresh.';

export const RACED_COPY =
  'The API refused the second request because the first had just rotated the token. Nothing was revoked; your session continues.';

/** One answer of the pair, as the screen lists it. */
export function describeAnswer(result: AuthResult): string {
  if (result.kind === 'token') return '200, with a new access token';
  if (result.kind === 'unreachable') return 'no answer';
  const { status, errorCode, title } = result.problem;
  return `${status} ${errorCode ?? title}`;
}

export function unexpectedCopy(pair: RacePair): string {
  return `The API answered ${describeAnswer(pair[0])} and ${describeAnswer(pair[1])}.`;
}

function claimValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join(', ');
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function Countdown({
  token,
  lifetimeSeconds,
}: {
  token: HeldAccessToken;
  lifetimeSeconds: number;
}) {
  const [now, setNow] = useState(() => performance.now());
  const left = remainingSeconds(lifetimeSeconds, token.arrivedAt, now);

  useEffect(() => {
    if (left <= 0) return;
    // Wake at the next whole second of the token's life, not of the wall clock.
    const spent = (now - token.arrivedAt) % 1000;
    const timer = setTimeout(() => setNow(performance.now()), 1000 - spent);
    return () => clearTimeout(timer);
  }, [left, now, token.arrivedAt]);

  if (left <= 0) return <p className="text-fg-primary">{EXPIRED_COPY}</p>;
  return (
    <p className="text-fg-primary">
      Expires in{' '}
      <span aria-live="off" className="font-mono tabular-nums text-fg-emphasis">
        {formatRemaining(left)}
      </span>
      .
    </p>
  );
}

function Pair({ pair }: { pair: RacePair }) {
  return (
    <ol className="flex flex-col gap-app-1 font-mono text-app-meta text-fg-secondary">
      {pair.map((result, index) => (
        <li key={index}>
          Request {index + 1}: {describeAnswer(result)}
        </li>
      ))}
    </ol>
  );
}

type Phase = { kind: 'ready' } | { kind: 'confirming' } | { kind: 'racing' } | RaceOutcome;

function RaceCard() {
  const [phase, setPhase] = useState<Phase>({ kind: 'ready' });
  const trigger = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    // Inventory section 4, as for a destructive dialog: the confirmation opens
    // on Cancel, and closing it returns focus to the control that opened it.
    if (phase.kind === 'confirming') cancel.current?.focus();
    if (phase.kind === 'ready' && cancelled.current) {
      cancelled.current = false;
      trigger.current?.focus();
    }
  }, [phase.kind]);

  async function race() {
    setPhase({ kind: 'racing' });
    setPhase(await raceRefreshes());
  }

  const confirming = phase.kind === 'confirming' || phase.kind === 'racing';

  return (
    <Card title="Refresh race">
      <div className="mt-app-2 flex flex-col gap-app-3">
        <p className="text-fg-secondary">{RACE_EXPLANATION}</p>

        {confirming ? (
          <div className="flex flex-col gap-app-2 rounded-card border border-border-danger p-app-3">
            <p className="text-fg-primary">{CONFIRM_COPY}</p>
            <div className="flex flex-wrap gap-app-2">
              <Button
                ref={cancel}
                pending={phase.kind === 'racing'}
                onClick={() => {
                  cancelled.current = true;
                  setPhase({ kind: 'ready' });
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                pending={phase.kind === 'racing'}
                onClick={() => void race()}
              >
                Confirm
              </Button>
            </div>
          </div>
        ) : null}

        {phase.kind === 'raced' ? (
          <div className="flex flex-col gap-app-2">
            <Pair pair={phase.pair} />
            <p role="status" className="text-fg-primary">
              {RACED_COPY}
            </p>
          </div>
        ) : null}

        {phase.kind === 'unexpected' ? (
          <div className="flex flex-col gap-app-2">
            <Pair pair={phase.pair} />
            <p role="status" className="text-fg-primary">
              {unexpectedCopy(phase.pair)}
            </p>
          </div>
        ) : null}

        {phase.kind === 'ready' ? (
          <div>
            <Button ref={trigger} onClick={() => setPhase({ kind: 'confirming' })}>
              Race two refreshes
            </Button>
          </div>
        ) : null}

        {phase.kind === 'raced' ? (
          <div>
            <Button onClick={() => setPhase({ kind: 'confirming' })}>Race again</Button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export function SessionScreen() {
  const token = useAccessToken();
  const claims = token === null ? null : decodeClaims(token.value);
  const lifetime = claims?.lifetimeSeconds ?? null;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-app-4 p-app-4">
      <h1 tabIndex={-1} className="text-app-title text-fg-emphasis">
        Session
      </h1>

      <Card title="Access token">
        <div className="mt-app-2 flex flex-col gap-app-1">
          {token === null || lifetime === null ? (
            <p className="text-fg-secondary">The token&apos;s lifetime cannot be read.</p>
          ) : (
            <>
              <Countdown key={token.value} token={token} lifetimeSeconds={lifetime} />
              <p className="font-mono text-app-meta text-fg-muted">
                Counted from the moment it arrived: exp - iat is {lifetime} s. The client clock is
                not consulted.
              </p>
            </>
          )}
        </div>
      </Card>

      <Card title="Claims">
        <div className="mt-app-2 overflow-x-auto">
          <Table caption="Access token claims">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Claim</TableHeaderCell>
                <TableHeaderCell>Value</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(claims?.all ?? {}).map(([name, value]) => (
                <TableRow key={name}>
                  <TableCell className="whitespace-nowrap font-mono text-fg-muted">
                    {name}
                  </TableCell>
                  <TableCell className="font-mono">{claimValue(value)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <RaceCard />
    </main>
  );
}
