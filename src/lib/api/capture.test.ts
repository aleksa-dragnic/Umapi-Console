import { http, HttpResponse } from 'msw';

import { setAccessToken } from '@/lib/api/access-token';
import { authApi } from '@/lib/api/auth-client';
import {
  BODY_LIMIT_BYTES,
  captureExchange,
  clearCaptures,
  currentCaptures,
  redactBody,
  type Capture,
} from '@/lib/api/capture';
import { api } from '@/lib/api/client';
import { MOCK_ACCOUNTS, advanceClock, simulateColdStart } from '@/lib/testing/mock';
import { server } from '@/lib/testing/server';
import { signIn, url } from '@/lib/testing/support';

const line = ({ request, outcome }: Capture) =>
  `${request.method} ${new URL(request.url).pathname} ${outcome.kind === 'response' ? outcome.response.status : outcome.kind}`;

/** What crossed the network, as MSW saw it, from the moment this is called. */
function networkLog(): string[] {
  const seen: string[] = [];
  server.events.on('request:start', ({ request }) => {
    seen.push(`${request.method} ${new URL(request.url).pathname}`);
  });
  return seen;
}

beforeEach(() => clearCaptures());
afterEach(() => server.events.removeAllListeners());

describe('the capture store (inventory section 3.8, ADR 0014)', () => {
  it('records every request the clients send, the silent refresh and its replay included (Gate 5)', async () => {
    setAccessToken((await signIn()).accessToken);
    const seen = networkLog();
    // Past the token's fifteen minutes: the read is answered 401, refreshed and replayed.
    advanceClock(16 * 60 * 1000);

    const { response } = await api.GET('/api/v1/users/{id}', {
      params: { path: { id: MOCK_ACCOUNTS.demo.id } },
    });

    expect(response.status).toBe(200);
    await vi.waitFor(() =>
      expect(currentCaptures().map(line)).toEqual([
        `GET /api/v1/users/${MOCK_ACCOUNTS.demo.id} 401`,
        'POST /api/v1/auth/refresh 200',
        `GET /api/v1/users/${MOCK_ACCOUNTS.demo.id} 200`,
      ]),
    );
    expect(currentCaptures().map((capture) => line(capture).replace(/ \S+$/, ''))).toEqual(seen);
  });

  it('shows a request while it is in flight, as pending, and settles it in place', async () => {
    setAccessToken((await signIn()).accessToken);
    simulateColdStart(200);

    const read = api.GET('/api/v1/roles');

    await vi.waitFor(() => expect(currentCaptures()).toHaveLength(1));
    const [pending] = currentCaptures();
    expect(pending?.outcome).toEqual({ kind: 'pending' });

    await read;
    await vi.waitFor(() => expect(currentCaptures()[0]?.outcome.kind).toBe('response'));
    const [settled] = currentCaptures();
    expect(settled?.id).toBe(pending?.id);
    expect(currentCaptures()).toHaveLength(1);
    if (settled?.outcome.kind !== 'response') throw new Error('not settled');
    expect(settled.outcome.response.status).toBe(200);
    expect(settled.outcome.durationMs).toBeGreaterThanOrEqual(150);
  });

  it('records a request nothing answered as unanswered, with its duration', async () => {
    setAccessToken((await signIn()).accessToken);
    // A transport failure the API has never been measured producing: once, here.
    server.use(http.get(url('/api/v1/roles'), () => HttpResponse.error(), { once: true }));

    await expect(api.GET('/api/v1/roles')).rejects.toThrow();

    const [capture] = currentCaptures();
    expect(capture?.outcome.kind).toBe('unanswered');
  });

  it('records a request the console cancelled as cancelled, not unanswered', async () => {
    setAccessToken((await signIn()).accessToken);
    const controller = new AbortController();
    controller.abort();

    await expect(api.GET('/api/v1/roles', { signal: controller.signal })).rejects.toThrow();

    const [capture] = currentCaptures();
    expect(capture?.outcome.kind).toBe('cancelled');
  });

  it('keeps no credential: the token, the password and the tokens a body carries become placeholders', async () => {
    const { data } = await authApi.POST('/api/v1/auth/login', {
      body: { email: MOCK_ACCOUNTS.demo.email, password: MOCK_ACCOUNTS.demo.password },
    });
    const token = data?.accessToken ?? '';
    setAccessToken(token);
    await api.GET('/api/v1/roles');

    await vi.waitFor(() => expect(currentCaptures().map(line)).toHaveLength(2));
    await vi.waitFor(() =>
      expect(currentCaptures().every(({ outcome }) => outcome.kind === 'response')).toBe(true),
    );
    const [login, roles] = currentCaptures();
    expect(login?.request.body?.text).toContain('"password":"$PASSWORD"');
    expect(login?.outcome.kind === 'response' && login.outcome.response.body?.text).toContain(
      '"accessToken":"$TOKEN"',
    );
    expect(roles?.request.headers).toContainEqual(['authorization', 'Bearer $TOKEN']);

    const everything = JSON.stringify(currentCaptures());
    expect(token).not.toBe('');
    expect(everything).not.toContain(token);
    expect(everything).not.toContain(MOCK_ACCOUNTS.demo.password);
  });

  it('redacts a refresh token as its own placeholder, and leaves a body that is not JSON alone', () => {
    expect(redactBody('{"refreshToken":"r","nested":[{"Password":"p"}]}')).toBe(
      '{"refreshToken":"$REFRESH_TOKEN","nested":[{"Password":"$PASSWORD"}]}',
    );
    expect(redactBody('password=p')).toBe('password=p');
    expect(redactBody('{"email":"a@b.c"}')).toBe('{"email":"a@b.c"}');
  });

  it('keeps a body to its first 64 kB and says so', async () => {
    const big = 'x'.repeat(BODY_LIMIT_BYTES + 10);

    const response = await captureExchange(new Request(url('/big')), () =>
      Promise.resolve(new Response(big, { status: 200 })),
    );

    expect(await response.text()).toHaveLength(big.length);
    await vi.waitFor(() => expect(currentCaptures()[0]?.outcome.kind).toBe('response'));
    const [capture] = currentCaptures();
    if (capture?.outcome.kind !== 'response') throw new Error('not settled');
    expect(capture.outcome.response.body?.truncated).toBe(true);
    expect(capture.outcome.response.body?.text).toHaveLength(BODY_LIMIT_BYTES);
  });

  it('belongs to one session: dropped when the token goes, kept while it is replaced', async () => {
    const session = await signIn();
    setAccessToken(session.accessToken);
    await api.GET('/api/v1/roles');
    expect(currentCaptures()).toHaveLength(1);

    setAccessToken(`${session.accessToken}.replaced`);
    expect(currentCaptures()).toHaveLength(1);

    setAccessToken(null);
    expect(currentCaptures()).toEqual([]);
  });
});
