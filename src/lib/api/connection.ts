import { useSyncExternalStore } from 'react';

import { currentCaptures, subscribeCaptures } from '@/lib/api/capture';

/**
 * Whether the console can reach the API: the `offline` state of inventory
 * section 2.2. Offline when the browser says so, or when the most recent
 * request to settle got no answer at all - which is how a browser reports a
 * dropped network, DNS and a CORS refusal alike. Read from the transport's
 * record (ADR 0014), so every request counts, whichever screen sent it.
 *
 * It ends with the browser's `online` event, or with the next request that is
 * answered: a single unanswered request on a working network must not leave the
 * console marked offline for the rest of the visit.
 */

let browserOffline = typeof navigator !== 'undefined' && !navigator.onLine;
/** Requests up to this id no longer count: the `online` event has answered for them. */
let forgivenThrough = 0;
let unanswered = lastSettledUnanswered();
let offline = browserOffline || unanswered;
const listeners = new Set<() => void>();

function lastSettled() {
  return currentCaptures()
    .filter(({ outcome }) => outcome.kind !== 'pending')
    .at(-1);
}

function lastSettledUnanswered(): boolean {
  const last = lastSettled();
  return last !== undefined && last.id > forgivenThrough && last.outcome.kind === 'unanswered';
}

function update(): void {
  const next = browserOffline || unanswered;
  if (next === offline) return;
  offline = next;
  listeners.forEach((listener) => listener());
}

subscribeCaptures(() => {
  unanswered = lastSettledUnanswered();
  update();
});

if (typeof window !== 'undefined') {
  window.addEventListener('offline', () => {
    browserOffline = true;
    update();
  });
  window.addEventListener('online', () => {
    browserOffline = false;
    forgivenThrough = lastSettled()?.id ?? forgivenThrough;
    unanswered = false;
    update();
  });
}

export function isOffline(): boolean {
  return offline;
}

export function subscribeConnection(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** True while the console cannot reach the API, re-rendering when that changes. */
export function useOffline(): boolean {
  return useSyncExternalStore(subscribeConnection, isOffline);
}
