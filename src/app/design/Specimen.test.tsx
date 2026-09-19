import { render, screen } from '@testing-library/react';

import Specimen from '@/app/design/Specimen';

describe('Specimen', () => {
  it('renders every primitive once per density', () => {
    render(<Specimen />);

    expect(screen.getByRole('heading', { name: 'Application density' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Editorial density' })).toBeInTheDocument();

    for (const primitive of [
      'Button',
      'Input',
      'Card',
      'Badge',
      'StatusDot',
      'CodeWindow',
      'Table',
      'Dialog',
    ]) {
      expect(screen.getAllByRole('region', { name: primitive })).toHaveLength(2);
    }
  });
});
