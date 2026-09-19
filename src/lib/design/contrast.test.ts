import { describe, expect, test } from 'vitest';

// Imported as text rather than read from disk: Vite resolves this at transform
// time, so the test does not depend on the environment giving import.meta.url
// a file: scheme, and there is still exactly one copy of every colour value in
// the repository.
import tokensCss from '../../../docs/tokens.css?raw';

import {
  contrastRatio,
  readDeclarations,
  resolveColour,
  type Declarations,
} from '@/lib/design/contrast';
import {
  AA_BODY_TEXT,
  AA_LARGE_TEXT,
  bodyText,
  largeTextOnly,
  neverText,
  surfaces,
} from '@/lib/design/tokens';

const declarations: Declarations = readDeclarations(tokensCss);
const canvas = resolveColour(surfaces.canvas, declarations);
const lift = resolveColour(surfaces.lift, declarations);

const ratioOn = (token: string, surface: string): number =>
  contrastRatio(resolveColour(token, declarations), surface);

describe('body text clears AA on the canvas', () => {
  test.each([...bodyText])('%s', (token) => {
    expect(ratioOn(token, canvas)).toBeGreaterThanOrEqual(AA_BODY_TEXT);
  });
});

describe('body text clears AA on the lift surface', () => {
  test.each([...bodyText])('%s', (token) => {
    expect(ratioOn(token, lift)).toBeGreaterThanOrEqual(AA_BODY_TEXT);
  });
});

describe('large text and UI only', () => {
  test.each([...largeTextOnly])('%s clears the large-text ratio', (token) => {
    expect(ratioOn(token, canvas)).toBeGreaterThanOrEqual(AA_LARGE_TEXT);
  });

  test.each([...largeTextOnly])('%s does not reach the body-text ratio', (token) => {
    // If one of these ever clears AA for body text it is no longer restricted,
    // and the restriction should be lifted here on purpose rather than left in
    // place as folklore.
    expect(ratioOn(token, canvas)).toBeLessThan(AA_BODY_TEXT);
  });
});

describe('the banned colours are unreachable as foregrounds', () => {
  test('no text token resolves to a colour banned from text', () => {
    const banned = new Set(neverText.map((token) => resolveColour(token, declarations)));
    const reachable = [...bodyText, ...largeTextOnly].map((token) =>
      resolveColour(token, declarations),
    );

    expect(reachable.filter((colour) => banned.has(colour))).toEqual([]);
  });

  test('every token named here is declared in docs/tokens.css', () => {
    const named = [...bodyText, ...largeTextOnly, ...neverText, ...Object.values(surfaces)];

    expect(() => named.map((token) => resolveColour(token, declarations))).not.toThrow();
  });
});