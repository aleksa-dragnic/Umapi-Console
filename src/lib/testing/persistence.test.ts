import { db, resetDatabase } from '@/lib/testing/db';
import { MOCK_ACCOUNTS } from '@/lib/testing/mock';
import { STORAGE_KEY, restoreRefreshTokens, saveRefreshTokens } from '@/lib/testing/persistence';
import { refresh, signIn } from '@/lib/testing/support';

// A reload, as the mock meets it: the page's database is rebuilt from the seed,
// and only what was saved comes back.
function reload(): void {
  saveRefreshTokens();
  resetDatabase();
  restoreRefreshTokens();
}

function snapshot() {
  return [...db().refreshTokens.values()].map(({ value, userId, expiresAtMs, state }) => ({
    value,
    userId,
    expiresAtMs,
    state,
  }));
}

afterEach(() => {
  sessionStorage.removeItem(STORAGE_KEY);
});

describe('mock: refresh tokens across a reload', () => {
  it('keeps every token and its state, so the cookie still names a session', async () => {
    await signIn();
    expect((await refresh()).status).toBe(200);
    const before = snapshot();
    expect(before.map((token) => token.state).sort()).toEqual(['active', 'rotated']);

    reload();

    expect(snapshot()).toEqual(before);
    expect((await refresh()).status).toBe(200);
  });

  it('brings a token saved mid-rotation back active, because the rotation was never written', () => {
    db().refreshTokens.set('mid-rotation', {
      value: 'mid-rotation',
      userId: MOCK_ACCOUNTS.demo.id,
      expiresAtMs: Date.now() + 60_000,
      state: 'rotating',
      rotation: Promise.resolve(),
    });

    reload();

    const token = db().refreshTokens.get('mid-rotation');
    expect(token?.state).toBe('active');
    expect(token).not.toHaveProperty('rotation');
  });

  it('starts from an empty table when what was saved cannot be read', () => {
    for (const saved of ['{not json', JSON.stringify([{ value: 1 }]), JSON.stringify({})]) {
      sessionStorage.setItem(STORAGE_KEY, saved);
      resetDatabase();
      restoreRefreshTokens();
      expect(db().refreshTokens.size).toBe(0);
    }
  });
});
