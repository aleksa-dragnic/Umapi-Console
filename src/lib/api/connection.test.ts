import { http, HttpResponse } from 'msw';

import { setAccessToken } from '@/lib/api/access-token';
import { clearCaptures } from '@/lib/api/capture';
import { api } from '@/lib/api/client';
import { isOffline } from '@/lib/api/connection';
import { server } from '@/lib/testing/server';
import { signIn, url } from '@/lib/testing/support';

beforeEach(() => clearCaptures());

describe('the connection (inventory section 2.2)', () => {
  it('is offline once a request gets no answer, and online again with the next answer', async () => {
    setAccessToken((await signIn()).accessToken);
    server.use(http.get(url('/api/v1/roles'), () => HttpResponse.error(), { once: true }));

    await expect(api.GET('/api/v1/roles')).rejects.toThrow();
    await vi.waitFor(() => expect(isOffline()).toBe(true));

    await api.GET('/api/v1/roles');
    await vi.waitFor(() => expect(isOffline()).toBe(false));
  });

  it('stays online when the console cancels a request itself', async () => {
    setAccessToken((await signIn()).accessToken);
    const controller = new AbortController();
    controller.abort();

    await expect(api.GET('/api/v1/roles', { signal: controller.signal })).rejects.toThrow();

    expect(isOffline()).toBe(false);
  });

  it("follows the browser's offline and online events", () => {
    window.dispatchEvent(new Event('offline'));
    expect(isOffline()).toBe(true);

    window.dispatchEvent(new Event('online'));
    expect(isOffline()).toBe(false);
  });

  it('is online again when the online event arrives after an unanswered request', async () => {
    setAccessToken((await signIn()).accessToken);
    server.use(http.get(url('/api/v1/roles'), () => HttpResponse.error(), { once: true }));
    await expect(api.GET('/api/v1/roles')).rejects.toThrow();
    await vi.waitFor(() => expect(isOffline()).toBe(true));

    window.dispatchEvent(new Event('online'));

    expect(isOffline()).toBe(false);
  });
});
