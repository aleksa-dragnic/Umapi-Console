import { render } from '@testing-library/react';

import { SkeletonRow } from '@/ui/SkeletonRow';

describe('SkeletonRow', () => {
  it('fills every column at the real row height and is hidden from assistive technology', () => {
    const { container } = render(
      <table>
        <tbody>
          <SkeletonRow columns={4} />
        </tbody>
      </table>,
    );
    const row = container.querySelector('tr');

    expect(row).toHaveAttribute('aria-hidden', 'true');
    expect(row).toHaveClass('h-[var(--size-row)]');
    expect(row?.querySelectorAll('td')).toHaveLength(4);
  });
});
