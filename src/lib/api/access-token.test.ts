import {
  currentAccessToken,
  heldAccessToken,
  setAccessToken,
  subscribeAccessToken,
} from '@/lib/api/access-token';

describe('the access token in memory (ADR 0007, ADR 0009)', () => {
  it('keeps the moment a token first arrived when the same token is set again', () => {
    setAccessToken('first');
    const arrived = heldAccessToken()?.arrivedAt;

    setAccessToken('first');

    expect(heldAccessToken()?.arrivedAt).toBe(arrived);
    expect(currentAccessToken()).toBe('first');
  });

  it('tells subscribers when the token changes, and only then', () => {
    const heard: Array<string | null> = [];
    const stop = subscribeAccessToken(() => heard.push(currentAccessToken()));

    setAccessToken('first');
    setAccessToken('first');
    setAccessToken('second');
    setAccessToken(null);
    stop();
    setAccessToken('third');

    expect(heard).toEqual(['first', 'second', null]);
  });
});
