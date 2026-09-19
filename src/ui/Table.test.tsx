import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/ui/Table';

describe('Table', () => {
  test('renders its column headers', () => {
    render(
      <Table caption="Users">
        <TableHead>
          <TableRow>
            <TableHeaderCell>Email</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody />
      </Table>,
    );

    expect(screen.getByRole('columnheader', { name: 'Email' })).toBeInTheDocument();
  });

  test('renders rows and cells', () => {
    render(
      <Table caption="Users">
        <TableBody>
          <TableRow>
            <TableCell>marko@example.com</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByRole('cell', { name: 'marko@example.com' })).toBeInTheDocument();
  });

  test('a column the API cannot sort by is not clickable', () => {
    render(
      <Table caption="Users">
        <TableHead>
          <TableRow>
            <TableHeaderCell>Status</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody />
      </Table>,
    );

    expect(screen.queryByRole('button', { name: 'Status' })).toBeNull();
    expect(screen.getByRole('columnheader', { name: 'Status' })).not.toHaveAttribute('aria-sort');
  });

  test('a sortable column reports its direction and can be activated', async () => {
    const onSort = vi.fn();
    render(
      <Table caption="Users">
        <TableHead>
          <TableRow>
            <TableHeaderCell sort="ascending" onSort={onSort}>
              Email
            </TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody />
      </Table>,
    );

    expect(screen.getByRole('columnheader', { name: 'Email' })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Email' }));

    expect(onSort).toHaveBeenCalledTimes(1);
  });
});