import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { AppMark } from '@/ui/AppMark';
import { MARK_PATHS } from '@/ui/mark';

import favicon from '../../public/favicon.svg?raw';

describe('AppMark', () => {
  test('it is an image named after the application', () => {
    render(<AppMark />);

    expect(screen.getByRole('img', { name: 'Umapi Console' })).toBeInTheDocument();
  });

  test('the favicon draws the same glyph, so the two cannot drift (pnpm brand)', () => {
    const paths = [...favicon.matchAll(/<path d="([^"]+)"/g)].map((match) => match[1]);

    expect(paths).toEqual([...MARK_PATHS]);
  });
});
