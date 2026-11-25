/**
 * The glyph of the app mark, in one place: the component draws it, and
 * `pnpm brand` draws the favicon, the touch icon and the preview image from it
 * (`scripts/brand.mjs`). The mark test holds the favicon to these paths.
 *
 * A U whose right stem returns as an arrow: the request goes in, the response
 * comes back. The name and the console's one idea, in two strokes
 * (DESIGN-DECISIONS section 12).
 */
export const MARK_VIEWBOX = '0 0 16 16';

export const MARK_PATHS = ['M3 3v6a4 4 0 0 0 8 0V3.5', 'M8.8 5.5 11 3.3l2.2 2.2'] as const;
