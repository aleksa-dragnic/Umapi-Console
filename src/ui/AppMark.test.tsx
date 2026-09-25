import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { AppMark } from '@/ui/AppMark';

describe('AppMark', () => {
  test('it is an image named after the application', () => {
    render(<AppMark />);

    expect(screen.getByRole('img', { name: 'Umapi Console' })).toBeInTheDocument();
  });
});
