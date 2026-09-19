import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';

import { Button } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';

function Harness({ destructive = false }: { destructive?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Lock user
      </button>
      <Dialog
        open={open}
        destructive={destructive}
        title="Lock Marko Petrovic"
        onClose={() => setOpen(false)}
      >
        <Button variant="destructive">Lock</Button>
      </Dialog>
    </>
  );
}

describe('Dialog', () => {
  test('a closed dialog renders nothing', () => {
    render(
      <Dialog open={false} title="Lock Marko Petrovic" onClose={() => undefined}>
        <Button variant="destructive">Lock</Button>
      </Dialog>,
    );

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('an open dialog is named by its heading', () => {
    render(
      <Dialog open title="Lock Marko Petrovic" onClose={() => undefined}>
        <Button variant="destructive">Lock</Button>
      </Dialog>,
    );

    expect(screen.getByRole('dialog', { name: 'Lock Marko Petrovic' })).toBeInTheDocument();
  });

  test('focus enters on the first control', async () => {
    render(<Harness />);

    await userEvent.click(screen.getByRole('button', { name: 'Lock user' }));

    expect(screen.getByRole('button', { name: 'Lock' })).toHaveFocus();
  });

  test('a destructive dialog starts on Cancel, not on the destructive control', async () => {
    render(<Harness destructive />);

    await userEvent.click(screen.getByRole('button', { name: 'Lock user' }));

    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  test('Escape closes it', async () => {
    render(<Harness />);

    await userEvent.click(screen.getByRole('button', { name: 'Lock user' }));
    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('the control that opened it regains focus on close', async () => {
    render(<Harness />);

    const trigger = screen.getByRole('button', { name: 'Lock user' });
    await userEvent.click(trigger);
    await userEvent.keyboard('{Escape}');

    expect(trigger).toHaveFocus();
  });
});