import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router';

import { DetailScreen } from '@/features/users/DetailScreen';
import { DirectoryScreen } from '@/features/users/DirectoryScreen';
import { USER_PATH, USERS_PATH } from '@/features/users/paths';
import { setAccessToken } from '@/lib/api/access-token';
import { signIn } from '@/lib/testing/support';

// Inventory sections 3.3 and 4: a row opens the user's detail and focus lands
// on its heading; the table is one tab stop that the arrow keys traverse; and
// Back returns to the same view with the opened row selected and focused.

function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.pathname + location.search}</p>;
}

function HistoryBack() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => void navigate(-1)}>
      History back
    </button>
  );
}

async function renderUsers(entry = USERS_PATH) {
  setAccessToken((await signIn()).accessToken);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path={USERS_PATH} element={<DirectoryScreen />} />
          <Route path={USER_PATH} element={<DetailScreen />} />
        </Routes>
        <Where />
        <HistoryBack />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const where = () => screen.getByTestId('where').textContent;
const table = () => screen.getByRole('table', { name: 'Users' });
const dataRows = async () => {
  await screen.findByText(/^\d{3} · \d+ results?$/);
  return within(table()).getAllByRole('row').slice(1);
};
const linkOf = (row: HTMLElement) => within(row).getByRole('link');

describe('the directory rows (inventory sections 3.3 and 4)', () => {
  it('activation: a click anywhere on a row opens its detail, and focus lands on the heading', async () => {
    await renderUsers();
    const row = (await dataRows())[2] as HTMLElement;
    const email = linkOf(row).textContent ?? '';
    const [, firstName] = within(row).getAllByRole('cell');

    await userEvent.click(firstName as HTMLElement);

    const heading = await screen.findByRole('heading', { level: 1, name: email });
    expect(where()).toMatch(/^\/users\/[0-9a-f-]{36}$/);
    expect(heading).toHaveFocus();
  });

  it('the rows are one tab stop, traversed with the arrow keys, Home and End', async () => {
    await renderUsers();
    const links = (await dataRows()).map(linkOf);
    const stops = () => links.filter((link) => link.tabIndex === 0);

    expect(stops()).toEqual([links[0]]);
    // Focus moved by the test itself, so React hears the update inside act.
    act(() => links[0]?.focus());

    await userEvent.keyboard('{ArrowDown}');
    expect(links[1]).toHaveFocus();
    expect(stops()).toEqual([links[1]]);

    await userEvent.keyboard('{End}');
    expect(links[links.length - 1]).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(links[links.length - 1]).toHaveFocus();

    await userEvent.keyboard('{Home}');
    expect(links[0]).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(links[0]).toHaveFocus();

    await userEvent.keyboard('{Enter}');
    expect(await screen.findByRole('heading', { level: 1 })).toHaveFocus();
  });

  it('Back returns to the same view, with the opened row selected and focused', async () => {
    await renderUsers('/users?page=2');
    const opened = (await dataRows())[3] as HTMLElement;
    const email = linkOf(opened).textContent ?? '';

    await userEvent.click(linkOf(opened));
    await screen.findByRole('button', { name: 'Assign role' });
    await userEvent.click(screen.getByRole('button', { name: 'History back' }));

    expect(where()).toBe('/users?page=2');
    const row = (await dataRows())[3] as HTMLElement;
    expect(linkOf(row)).toHaveTextContent(email);
    await waitFor(() => expect(linkOf(row)).toHaveFocus());
    expect(row).toHaveAttribute('aria-current', 'true');
    expect(linkOf(row).tabIndex).toBe(0);
    expect(
      (await dataRows()).filter((candidate) => candidate.hasAttribute('aria-current')),
    ).toEqual([row]);
  });

  it("the detail's way back returns to the view it came from, with the row selected", async () => {
    await renderUsers('/users?q=ovic');
    const opened = (await dataRows())[1] as HTMLElement;
    const email = linkOf(opened).textContent ?? '';

    await userEvent.click(linkOf(opened));
    await userEvent.click(await screen.findByRole('link', { name: 'Back to users' }));

    expect(where()).toBe('/users?q=ovic');
    const row = (await dataRows())[1] as HTMLElement;
    expect(linkOf(row)).toHaveTextContent(email);
    expect(row).toHaveAttribute('aria-current', 'true');
  });

  it('a changed filter forgets the selection', async () => {
    await renderUsers();
    await userEvent.click(linkOf((await dataRows())[0] as HTMLElement));
    await userEvent.click(await screen.findByRole('link', { name: 'Back to users' }));
    await dataRows();
    expect(
      within(table())
        .getAllByRole('row')
        .some((row) => row.hasAttribute('aria-current')),
    ).toBe(true);

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'Active');

    await waitFor(() => expect(where()).toBe('/users?status=active'));
    expect(
      within(table())
        .getAllByRole('row')
        .some((row) => row.hasAttribute('aria-current')),
    ).toBe(false);
  });
});
