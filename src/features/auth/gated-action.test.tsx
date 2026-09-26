import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { setAccessToken } from '@/lib/api/access-token';
import { api } from '@/lib/api/client';
import { useCan } from '@/lib/api/permissions';
import { MOCK_ACCOUNTS } from '@/lib/testing/mock';
import { server } from '@/lib/testing/server';
import { signIn } from '@/lib/testing/support';
import { Button } from '@/ui/Button';

// Gate 3: a gated action states its reason and never reaches the network
// (inventory section 2.6). The action is the lock of section 3.6, which needs
// `users.lock` (row 48); the screen that carries it arrives in PR 13 and uses
// the same `useCan`.

function LockAction() {
  const permit = useCan('users.lock');
  return (
    <Button
      variant="destructive"
      disabledReason={permit.allowed ? undefined : permit.reason}
      onClick={() =>
        void api.POST('/api/v1/users/{id}/lock', {
          params: { path: { id: MOCK_ACCOUNTS.demo.id } },
        })
      }
    >
      Lock
    </Button>
  );
}

function capturedRequests(): string[] {
  const seen: string[] = [];
  server.events.on('request:start', ({ request }) => seen.push(new URL(request.url).pathname));
  return seen;
}

afterEach(() => server.events.removeAllListeners());

describe('a gated action (Gate 3)', () => {
  it('is aria-disabled, states its reason, and sends nothing when activated', async () => {
    setAccessToken((await signIn(MOCK_ACCOUNTS.demo)).accessToken);
    const requests = capturedRequests();
    render(<LockAction />);

    const lock = screen.getByRole('button', { name: 'Lock' });
    await userEvent.click(lock);

    expect(lock).toHaveAttribute('aria-disabled', 'true');
    expect(lock).toHaveAccessibleDescription(
      'Requires users.lock. This account holds users.read, roles.read.',
    );
    expect(requests).toEqual([]);
  });

  it('reaches the network for an account that holds the permission', async () => {
    setAccessToken((await signIn(MOCK_ACCOUNTS.admin)).accessToken);
    const requests = capturedRequests();
    render(<LockAction />);

    await userEvent.click(screen.getByRole('button', { name: 'Lock' }));

    await vi.waitFor(() =>
      expect(requests).toEqual([`/api/v1/users/${MOCK_ACCOUNTS.demo.id}/lock`]),
    );
  });

  it('follows the token: a sign-in as another account changes what is permitted', async () => {
    setAccessToken((await signIn(MOCK_ACCOUNTS.demo)).accessToken);
    render(<LockAction />);
    expect(screen.getByRole('button', { name: 'Lock' })).toHaveAttribute('aria-disabled', 'true');

    const admin = await signIn(MOCK_ACCOUNTS.admin);
    act(() => setAccessToken(admin.accessToken));

    expect(await screen.findByRole('button', { name: 'Lock' })).not.toHaveAttribute(
      'aria-disabled',
    );
  });
});
