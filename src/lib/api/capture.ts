import { useSyncExternalStore } from 'react';

import { currentAccessToken, subscribeAccessToken } from '@/lib/api/access-token';

/**
 * What the inspector shows: every request the console sends to the API, and
 * what came back (inventory section 3.8). Recorded at the transport, the one
 * `fetch` both clients send through, so a request cannot reach the network
 * without appearing here - the silent refresh's replay included. A response
 * the console builds itself, such as the refusal a waiting request is handed
 * when its refresh was refused, never crossed the network and is not recorded.
 * See docs/adr/0014-the-inspector-records-at-the-transport.md.
 *
 * It lives in `lib/api` rather than in the inspector feature because the
 * client writes it, and `lib/` imports nothing above it (ADR 0003). The
 * inspector only reads it.
 *
 * Three rules hold for everything in it:
 *
 * - **No credential.** At the moment of recording, the `Authorization` header
 *   becomes `Bearer $TOKEN`, and in any JSON body, sent or received, a
 *   `password` becomes `$PASSWORD`, an `accessToken` `$TOKEN` and a
 *   `refreshToken` `$REFRESH_TOKEN`. No rendering, screenshot or copy can leak
 *   what was never kept.
 * - **One session.** The record is dropped whenever a session ends - the token
 *   goes from held to none - for the reason the query cache is (ADR 0010): a
 *   second account on the same tab never sees the first one's responses.
 * - **Bounded bodies.** A body is kept to its first 64 kB, and says so.
 */

export const TOKEN_PLACEHOLDER = '$TOKEN';
export const PASSWORD_PLACEHOLDER = '$PASSWORD';
export const REFRESH_TOKEN_PLACEHOLDER = '$REFRESH_TOKEN';

/** JSON keys whose string values are credentials, compared case-insensitively. */
const SECRETS: Readonly<Record<string, string>> = {
  password: PASSWORD_PLACEHOLDER,
  accesstoken: TOKEN_PLACEHOLDER,
  refreshtoken: REFRESH_TOKEN_PLACEHOLDER,
};

/** Inventory section 3.8: a body over 64 kB is cut there. */
export const BODY_LIMIT_BYTES = 64 * 1024;

export type Header = readonly [name: string, value: string];

export interface CapturedBody {
  readonly text: string;
  readonly truncated: boolean;
}

export interface CapturedRequest {
  readonly method: string;
  readonly url: string;
  readonly headers: readonly Header[];
  readonly body: CapturedBody | null;
}

export interface CapturedResponse {
  readonly status: number;
  readonly statusText: string;
  /** Only what the browser lets the page read: the API's CORS policy (observed row 53). */
  readonly headers: readonly Header[];
  readonly body: CapturedBody | null;
}

/**
 * Where a request stands. `unanswered` is a request nothing answered - offline,
 * DNS, or a CORS refusal, which a browser reports the same way. `cancelled` is
 * a request the console abandoned itself before an answer arrived - a screen
 * that stopped needing it, or React mounting a screen twice in development - so
 * it says nothing about the network or the API.
 */
export type Outcome =
  | { readonly kind: 'pending' }
  | { readonly kind: 'response'; readonly response: CapturedResponse; readonly durationMs: number }
  | { readonly kind: 'unanswered'; readonly durationMs: number }
  | { readonly kind: 'cancelled'; readonly durationMs: number };

export interface Capture {
  readonly id: number;
  readonly request: CapturedRequest;
  readonly outcome: Outcome;
}

let captures: readonly Capture[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function publish(next: readonly Capture[]): void {
  captures = next;
  listeners.forEach((listener) => listener());
}

/** Every request recorded, oldest first. */
export function currentCaptures(): readonly Capture[] {
  return captures;
}

/** Called whenever the record changes. Returns the function that stops it. */
export function subscribeCaptures(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The record, re-rendering whenever it changes. */
export function useCaptures(): readonly Capture[] {
  return useSyncExternalStore(subscribeCaptures, currentCaptures);
}

export function clearCaptures(): void {
  if (captures.length > 0) publish([]);
}

// The record belongs to one session: when the token held goes to none, it goes.
// A request still in flight at that moment finds no entry to settle and is
// dropped with the rest.
let tokenHeld = currentAccessToken() !== null;
subscribeAccessToken(() => {
  const held = currentAccessToken() !== null;
  if (tokenHeld && !held) clearCaptures();
  tokenHeld = held;
});

function settle(id: number, outcome: Outcome): void {
  if (!captures.some((capture) => capture.id === id)) return;
  publish(captures.map((capture) => (capture.id === id ? { ...capture, outcome } : capture)));
}

function redactHeader([name, value]: Header): Header {
  if (name.toLowerCase() !== 'authorization') return [name, value];
  return [name, value.startsWith('Bearer ') ? `Bearer ${TOKEN_PLACEHOLDER}` : TOKEN_PLACEHOLDER];
}

function headersOf(headers: Headers): Header[] {
  return [...headers.entries()];
}

function redactSecrets(value: unknown): { value: unknown; changed: boolean } {
  if (Array.isArray(value)) {
    let changed = false;
    const items = value.map((item) => {
      const result = redactSecrets(item);
      changed ||= result.changed;
      return result.value;
    });
    return { value: items, changed };
  }
  if (value !== null && typeof value === 'object') {
    let changed = false;
    const entries = Object.entries(value).map(([key, item]) => {
      const placeholder = SECRETS[key.toLowerCase()];
      if (placeholder !== undefined && typeof item === 'string') {
        changed = true;
        return [key, placeholder];
      }
      const result = redactSecrets(item);
      changed ||= result.changed;
      return [key, result.value];
    });
    return { value: Object.fromEntries(entries), changed };
  }
  return { value, changed: false };
}

/** A body with every credential replaced by its placeholder; anything that is not JSON is kept as it is. */
export function redactBody(text: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return text;
  }
  const result = redactSecrets(parsed);
  return result.changed ? JSON.stringify(result.value) : text;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bounded(text: string): CapturedBody {
  const bytes = encoder.encode(text);
  if (bytes.length <= BODY_LIMIT_BYTES) return { text, truncated: false };
  return { text: decoder.decode(bytes.slice(0, BODY_LIMIT_BYTES)), truncated: true };
}

/** The body of a copy the caller made, or null when there is none to read. */
async function textOf(copy: Request | Response): Promise<string | null> {
  if (copy.body === null) return null;
  try {
    return await copy.text();
  } catch {
    return null;
  }
}

async function describeResponse(copy: Response): Promise<CapturedResponse> {
  const { status, statusText, headers } = copy;
  const text = await textOf(copy);
  return {
    status,
    statusText,
    headers: headersOf(headers),
    body: text === null || text === '' ? null : bounded(redactBody(text)),
  };
}

/**
 * Sends a request through `send` and records it. The entry appears as soon as
 * the request leaves, as `pending`, and is settled in place when the response
 * arrives or nothing does (inventory section 3.8). The response is handed back
 * untouched; the record reads a copy of its body.
 */
export async function captureExchange(
  request: Request,
  send: (request: Request) => Promise<Response>,
): Promise<Response> {
  const requestText = await textOf(request.clone());
  const id = nextId++;
  publish([
    ...captures,
    {
      id,
      request: {
        method: request.method,
        url: request.url,
        headers: headersOf(request.headers).map(redactHeader),
        body: requestText === null ? null : bounded(redactBody(requestText)),
      },
      outcome: { kind: 'pending' },
    },
  ]);

  const started = performance.now();
  let response: Response;
  try {
    response = await send(request);
  } catch (error) {
    const durationMs = performance.now() - started;
    settle(
      id,
      request.signal.aborted
        ? { kind: 'cancelled', durationMs }
        : { kind: 'unanswered', durationMs },
    );
    throw error;
  }
  const durationMs = performance.now() - started;
  void describeResponse(response.clone()).then((captured) =>
    settle(id, { kind: 'response', response: captured, durationMs }),
  );
  return response;
}
