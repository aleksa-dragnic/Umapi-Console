import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Select } from '@/ui/Select';

const OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'Locked', label: 'Locked' },
];

describe('Select', () => {
  it('is named by its label and offers its options', () => {
    render(<Select label="Status" options={OPTIONS} />);

    const select = screen.getByRole('combobox', { name: 'Status' });
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'All statuses',
      'Locked',
    ]);
    expect(select).toHaveValue('');
  });

  it('reports the value chosen by keyboard or pointer', async () => {
    const chosen: string[] = [];
    render(
      <Select
        label="Status"
        options={OPTIONS}
        onChange={(event) => chosen.push(event.target.value)}
      />,
    );

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'Locked');

    expect(chosen).toEqual(['Locked']);
  });
});
