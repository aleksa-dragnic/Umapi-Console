import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';

import type { DirectoryPage } from '@/features/users/api';
import {
  DirectoryScreen,
  NO_USERS_COPY,
  UNREACHABLE_COPY,
  USERS_PATH,
  emptyStateOf,
} from '@/features/users/DirectoryScreen';
import type { DirectoryQuery } from '@/features/users/url-state';
import { setAccessToken } from '@/lib/api/access-token';
import { simulateColdStart } from '@/lib/testing/mock';
import { server } from '@/lib/testing/server';
import { call, signIn, url } from '@/lib/testing/support';

function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.pathname + location.search}</p>;
}

async function renderDirectory(entry = USERS_PATH) {
  setAccessToken((await signIn()).accessToken);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path={USERS_PATH} element={<DirectoryScreen />} />
        </Routes>
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return view;
}

const table = () => screen.getByRole('table', { name: 'Users' });
const dataRows = () => within(table()).getAllByRole('row').slice(1);
const where = () => screen.getByTestId('where').textContent;
const footerLine = () => screen.findByText(/^\d{3} · \d+ results?$/);

describe('the directory (inventory section 3.3)', () => {
  it('loading-first: skeleton rows at the real height, with the toolbar already live', async () => {
    const { container } = await renderDirectory();

    expect(container.querySelectorAll('tr[aria-hidden="true"]')).toHaveLength(10);
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByLabelText('Search')).toBeEnabled();
    expect(await footerLine()).toHaveTextContent('200 · 130 results');
  });

  it('ready: a page of rows, and the footer says what X-Pagination said', async () => {
    await renderDirectory();

    expect(await footerLine()).toHaveTextContent('200 · 130 results');
    expect(dataRows()).toHaveLength(10);
    expect(screen.getByText('Page 1 of 13')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByText('Page 2 of 13')).toBeInTheDocument();
    expect(where()).toBe('/users?page=2');
    expect(screen.getByRole('button', { name: 'Previous' })).toBeInTheDocument();
  });

  it('loading-refetch: keeps the rows on screen, dimmed, while the next page loads', async () => {
    await renderDirectory();
    await footerLine();
    const first = dataRows()[0]?.textContent;
    simulateColdStart(400);

    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(table()).toHaveClass('opacity-60');
    expect(dataRows()[0]?.textContent).toBe(first);
    expect(await screen.findByText('Page 2 of 13')).toBeInTheDocument();
    expect(table()).not.toHaveClass('opacity-60');
  });

  it('debounces the search, shows that it is pending, and goes back to page 1', async () => {
    await renderDirectory('/users?page=2');
    await footerLine();

    await userEvent.type(screen.getByLabelText('Search'), 'ovic');

    expect(screen.getByText('Search pending')).toBeInTheDocument();
    expect(where()).toBe('/users?page=2');
    expect(await screen.findByText('200 · 30 results')).toBeInTheDocument();
    expect(where()).toBe('/users?q=ovic');
    expect(screen.queryByText('Search pending')).not.toBeInTheDocument();
  });

  it('empty-search: repeats the term as sent, and Clear search brings the rows back', async () => {
    await renderDirectory('/users?q=zzz');

    expect(await screen.findByText('No users match "zzz".')).toBeInTheDocument();
    expect(screen.getByText('200 · 0 results')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));

    // The unfiltered view was never read here, so it is a 200, not a 304.
    expect(await screen.findByText('200 · 130 results')).toBeInTheDocument();
    expect(where()).toBe('/users');
    expect(screen.getByLabelText('Search')).toHaveValue('');
  });

  it('empty-page: says where the end is, and offers page 1 instead of Previous', async () => {
    await renderDirectory('/users?page=99');

    expect(
      await screen.findByText('Page 99 is past the end. There are 13 pages.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Go to page 1' }));

    expect(await screen.findByText('Page 1 of 13')).toBeInTheDocument();
    expect(where()).toBe('/users');
  });

  it('sorts by the API whitelist, ascending first, and writes the order into the address', async () => {
    await renderDirectory();
    await footerLine();
    const header = (name: string) => screen.getByRole('columnheader', { name });

    expect(header('Email')).toHaveAttribute('aria-sort', 'ascending');
    await userEvent.click(within(header('Last name')).getByRole('button'));
    expect(where()).toBe('/users?sort=lastName%3Aasc');
    expect(header('Last name')).toHaveAttribute('aria-sort', 'ascending');
    expect(header('Email')).toHaveAttribute('aria-sort', 'none');

    await userEvent.click(within(header('Last name')).getByRole('button'));
    expect(where()).toBe('/users?sort=lastName%3Adesc');
  });

  it('filters by status and goes back to page 1', async () => {
    await renderDirectory('/users?page=3');
    await footerLine();

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'Locked');

    expect(where()).toBe('/users?status=locked');
    await waitFor(() => expect(table()).not.toHaveClass('opacity-60'));
    expect(screen.getByText(/^Page 1 of \d+$/)).toBeInTheDocument();
    const rows = dataRows();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.textContent?.includes('Locked'))).toBe(true);
  });

  it('not-modified: a page read again answers 304, and the footer says so (section 2.9)', async () => {
    await renderDirectory();
    await footerLine();
    const first = dataRows().map((row) => row.textContent);

    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Page 2 of 13');
    await userEvent.click(screen.getByRole('button', { name: 'Previous' }));

    expect(await screen.findByText('304 · 130 results')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 13')).toBeInTheDocument();
    expect(dataRows().map((row) => row.textContent)).toEqual(first);
  });

  it('an invalid address falls back to page 1 and the default order, rather than erroring (Gate 4)', async () => {
    await renderDirectory('/users?page=-3&sort=nonsense');

    expect(await footerLine()).toHaveTextContent('200 · 130 results');
    expect(screen.getByText('Page 1 of 13')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Email' })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('error: the status, the title and the traceId in place of the table, and Retry (section 2.8)', async () => {
    // The mock has no 5xx on this endpoint; the transport shape of section 2.8, once.
    server.use(
      http.get(
        url('/api/v1/users'),
        () =>
          HttpResponse.json(
            { status: 503, title: 'Service Unavailable', traceId: '00-4bf92f3577b34da6-01' },
            { status: 503, headers: { 'Content-Type': 'application/problem+json' } },
          ),
        { once: true },
      ),
    );
    await renderDirectory();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('503 Service Unavailable');
    expect(alert).toHaveTextContent('00-4bf92f3577b34da6-01');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await footerLine()).toHaveTextContent('200 · 130 results');
  });

  it('error: a request with no answer at all says so, and Retry', async () => {
    server.use(http.get(url('/api/v1/users'), () => HttpResponse.error(), { once: true }));
    await renderDirectory();

    expect(await screen.findByRole('alert')).toHaveTextContent(UNREACHABLE_COPY);

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await footerLine()).toHaveTextContent('200 · 130 results');
  });

  it('rate-limited: a 429 on the read holds Retry until Retry-After has passed (row 52)', async () => {
    const session = await signIn();
    // Reads are a hundred a minute per user; the directory's is the hundred and first.
    for (let read = 0; read < 100; read += 1) {
      await call('/api/v1/roles', { headers: session.auth });
    }
    setAccessToken(session.accessToken);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[USERS_PATH]}>
          <Routes>
            <Route path={USERS_PATH} element={<DirectoryScreen />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('429 Too Many Requests');
    const retry = screen.getByRole('button', { name: 'Retry' });
    expect(retry).toHaveAttribute('aria-disabled', 'true');
    expect(retry).toHaveAccessibleDescription(/^Too many attempts\. Try again in \d+ seconds?\.$/);
  });
});

describe('which empty state a page with no rows is', () => {
  const data = (totalCount: number, totalPages: number): DirectoryPage => ({
    users: [],
    status: 200,
    etag: null,
    pagination: {
      currentPage: 1,
      totalPages,
      pageSize: 10,
      totalCount,
      hasPrevious: false,
      hasNext: false,
    },
  });
  const query = (partial: Partial<DirectoryQuery>): DirectoryQuery => ({
    page: 1,
    q: '',
    sort: null,
    status: null,
    ...partial,
  });

  it.each([
    [
      'past the last page',
      data(12, 2),
      query({ page: 3 }),
      'Page 3 is past the end. There are 2 pages.',
      'Go to page 1',
    ],
    [
      'past the only page',
      data(4, 1),
      query({ page: 2 }),
      'Page 2 is past the end. There is 1 page.',
      'Go to page 1',
    ],
    [
      'a term',
      data(0, 0),
      query({ q: 'ovic', status: 'Locked' }),
      'No users match "ovic".',
      'Clear search',
    ],
    [
      'a status and no term',
      data(0, 0),
      query({ status: 'Locked' }),
      'No users with status Locked.',
      'Clear filter',
    ],
    ['nothing at all', data(0, 0), query({}), NO_USERS_COPY, null],
  ] as const)('%s', (_, page, current, message, label) => {
    const state = emptyStateOf(page, current);
    expect(state.message).toBe(message);
    expect(state.action?.label ?? null).toBe(label);
  });
});
