import { clearOnSessionEnd, createQueryClient } from '@/app/query-client';
import { setAccessToken } from '@/lib/api/access-token';

describe('the query cache belongs to one session (ADR 0010)', () => {
  it('is dropped when the access token is cleared, and kept while it is replaced', () => {
    const client = createQueryClient();
    const stop = clearOnSessionEnd(client);
    setAccessToken('first');
    client.setQueryData(['users'], ['someone']);

    setAccessToken('second');
    expect(client.getQueryData(['users'])).toEqual(['someone']);

    setAccessToken(null);
    expect(client.getQueryData(['users'])).toBeUndefined();
    stop();
  });

  it('does not retry and does not refetch on focus', () => {
    const { queries } = createQueryClient().getDefaultOptions();

    expect(queries?.retry).toBe(false);
    expect(queries?.refetchOnWindowFocus).toBe(false);
  });
});
