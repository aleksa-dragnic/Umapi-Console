import { render, screen } from '@testing-library/react';

import { EntityStatus } from '@/ui/EntityStatus';

describe('EntityStatus (DESIGN-DECISIONS section 10)', () => {
  it.each([
    ['Active', 0],
    ['Pending', 0],
    ['Locked', 1],
    ['Deactivated', 1],
  ])('%s is text, with %i glyph', (status, glyphs) => {
    const { container } = render(<EntityStatus status={status} />);

    expect(screen.getByText(status)).toBeInTheDocument();
    expect(container.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(glyphs);
  });

  it('draws Locked and Deactivated with different glyphs', () => {
    const { container } = render(
      <>
        <EntityStatus status="Locked" />
        <EntityStatus status="Deactivated" />
      </>,
    );
    const [locked, deactivated] = [...container.querySelectorAll('svg')].map(
      (svg) => svg.innerHTML,
    );

    expect(locked).not.toBe(deactivated);
  });

  it('shows a value outside the four as it came', () => {
    render(<EntityStatus status="Archived" />);

    expect(screen.getByText('Archived')).toBeInTheDocument();
  });

  it('never colours a status: no status token on any of them', () => {
    const { container } = render(
      <>
        {['Active', 'Pending', 'Locked', 'Deactivated'].map((status) => (
          <EntityStatus key={status} status={status} />
        ))}
      </>,
    );

    expect(container.innerHTML).not.toMatch(/status-[1-5]xx|fg-danger/);
  });
});
