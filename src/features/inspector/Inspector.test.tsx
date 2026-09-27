import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  COPIED_COPY,
  EMPTY_COPY,
  Inspector,
  NOT_MODIFIED_BODY_COPY,
  PENDING_COPY,
  WITHHELD_COPY,
} from '@/features/inspector/Inspector';
import { setAccessToken } from '@/lib/api/access-token';
import {
  BODY_LIMIT_BYTES,
  captureExchange,
  clearCaptures,
  currentCaptures,
} from '@/lib/api/capture';
import { api } from '@/lib/api/client';
import { MOCK_ACCOUNTS, simulateColdStart } from '@/lib/testing/mock';
import { signIn, url } from '@/lib/testing/support';

async function signedIn(): Promise<string> {
  const { accessToken } = await signIn();
  setAccessToken(accessToken);
  return accessToken;
}

/** Every recorded request answered, so nothing settles after the screen is drawn. */
async function settled(): Promise<void> {
  await vi.waitFor(() =>
    expect(currentCaptures().every(({ outcome }) => outcome.kind !== 'pending')).toBe(true),
  );
}

/** A code window, by the caption it carries. */
function codeWindow(caption: string | RegExp): HTMLElement {
  const figure = screen.getByText(caption, { selector: 'figcaption' }).closest('figure');
  if (figure === null) throw new Error('no code window');
  return figure;
}

const toggle = () => screen.getByRole('button', { name: 'Inspector' });
const rows = () => within(screen.getByRole('list', { name: 'Requests' })).getAllByRole('button');

beforeEach(() => clearCaptures());

describe('the inspector (inventory section 3.8)', () => {
  it('collapsed: one line with the most recent request - status, method, path, duration', async () => {
    await signedIn();
    await api.GET('/api/v1/roles');
    await settled();
    render(<Inspector />);

    const strip = screen.getByRole('region', { name: 'Inspector' });
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(await within(strip).findByText('200')).toBeInTheDocument();
    expect(within(strip).getByText('GET')).toBeInTheDocument();
    expect(within(strip).getByText('/api/v1/roles')).toBeInTheDocument();
    expect(within(strip).getByText(/^\d+ ms$/)).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Requests' })).not.toBeInTheDocument();
  });

  it('empty: expanded before any request, it says what will appear', async () => {
    render(<Inspector />);

    await userEvent.click(toggle());

    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(EMPTY_COPY)).toBeInTheDocument();
  });

  it('expanded: newest first, the newest selected until another is chosen, both panes filled', async () => {
    await signedIn();
    await api.GET('/api/v1/users/{id}', { params: { path: { id: MOCK_ACCOUNTS.demo.id } } });
    await api.GET('/api/v1/roles');
    await settled();
    render(<Inspector />);
    await userEvent.click(toggle());

    expect(rows()).toHaveLength(2);
    expect(rows()[0]).toHaveTextContent('/api/v1/roles');
    expect(rows()[0]).toHaveAttribute('aria-current', 'true');
    expect(screen.getByText(WITHHELD_COPY)).toBeInTheDocument();

    await userEvent.click(rows()[1]!);

    expect(rows()[1]).toHaveAttribute('aria-current', 'true');
    expect(rows()[0]).not.toHaveAttribute('aria-current');
    expect(codeWindow(`GET /api/v1/users/${MOCK_ACCOUNTS.demo.id}`)).toHaveTextContent(
      'authorization: Bearer $TOKEN',
    );
    const response = codeWindow(/^200 .*· \d+ ms$/);
    // JSON is laid out, whatever its media type.
    expect(response).toHaveTextContent(`"email": "${MOCK_ACCOUNTS.demo.email}"`);
    expect(response).toHaveTextContent(/etag: W\//i);
  });

  it('pending: the row appears at once with no duration, then settles in place', async () => {
    await signedIn();
    render(<Inspector />);
    await userEvent.click(toggle());
    simulateColdStart(200);

    let read: Promise<unknown> = Promise.resolve();
    act(() => {
      read = api.GET('/api/v1/roles');
    });

    await screen.findByRole('list', { name: 'Requests' });
    expect(within(rows()[0]!).getByText('pending')).toBeInTheDocument();
    expect(within(rows()[0]!).queryByText(/ ms$/)).not.toBeInTheDocument();
    expect(screen.getByText(PENDING_COPY)).toBeInTheDocument();
    await act(() => read);
    expect(await within(rows()[0]!).findByText('200')).toBeInTheDocument();
    expect(within(rows()[0]!).getByText(/^\d+ ms$/)).toBeInTheDocument();
    expect(rows()).toHaveLength(1);
  });

  it('a 304 has no body and says so', async () => {
    await signedIn();
    const first = await api.GET('/api/v1/roles');
    await api.GET('/api/v1/roles', {
      headers: { 'If-None-Match': first.response.headers.get('ETag') ?? '' },
    });
    await settled();
    render(<Inspector />);
    await userEvent.click(toggle());

    expect(codeWindow(/^304 /)).toHaveTextContent(NOT_MODIFIED_BODY_COPY);
  });

  it('truncated: a body over 64 kB is shown to 64 kB, and says so', async () => {
    await captureExchange(new Request(url('/api/v1/users')), () =>
      Promise.resolve(new Response('x'.repeat(BODY_LIMIT_BYTES + 1), { status: 200 })),
    );
    await settled();
    render(<Inspector />);
    await userEvent.click(toggle());

    expect(await screen.findByText('Response truncated at 64 kB.')).toBeInTheDocument();
  });

  it('a request nothing answered reads "no response"', async () => {
    await captureExchange(new Request(url('/api/v1/users')), () =>
      Promise.reject(new TypeError('Failed to fetch')),
    ).catch(() => undefined);
    render(<Inspector />);

    expect(screen.getByText('no response')).toBeInTheDocument();
  });

  it('copies the selected request as curl, with $TOKEN and not the token', async () => {
    const user = userEvent.setup();
    const token = await signedIn();
    await api.GET('/api/v1/roles');
    await settled();
    render(<Inspector />);
    await user.click(toggle());

    await user.click(screen.getByRole('button', { name: 'Copy as curl' }));

    const copied = await navigator.clipboard.readText();
    expect(copied).toContain(`curl -X GET '${url('/api/v1/roles')}'`);
    expect(copied).toContain('"$TOKEN"');
    expect(copied).not.toContain(token);
    expect(screen.getByRole('status')).toHaveTextContent(COPIED_COPY);
  });

  it('clear empties the list', async () => {
    await signedIn();
    await api.GET('/api/v1/roles');
    await settled();
    render(<Inspector />);
    await userEvent.click(toggle());

    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(screen.getByText(EMPTY_COPY)).toBeInTheDocument();
  });

  it('is reached by keyboard, and Escape closes it and returns focus to it (inventory section 4)', async () => {
    render(<Inspector />);

    await userEvent.tab();
    expect(toggle()).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');

    await userEvent.tab();
    await userEvent.keyboard('{Escape}');

    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(toggle()).toHaveFocus();
  });

  it('leaves Escape to an open dialog, which closes first (inventory section 4)', async () => {
    render(
      <>
        <Inspector />
        <div role="dialog" aria-modal="true" aria-label="Open dialog" />
      </>,
    );
    await userEvent.click(toggle());

    await userEvent.keyboard('{Escape}');

    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
  });
});
