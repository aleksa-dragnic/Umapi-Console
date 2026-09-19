/**
 * The permission sets the contrast test asserts over.
 *
 * Values live in docs/tokens.css so Tailwind can generate utilities from them;
 * the rules about where a colour may appear live here. This file therefore
 * holds no colour values at all - it names tokens, and the test resolves each
 * name against the stylesheet at run time. A value duplicated here would be a
 * second source of truth, and the first one to go stale.
 *
 * See docs/DESIGN-DECISIONS.md sections 3 and 11.
 */

/** Surfaces a foreground colour is measured against. */
export const surfaces = {
  /** The flat black application canvas. */
  canvas: '--color-canvas',
  /** Modal and panel backgrounds, the only surface lifted above the canvas. */
  lift: '--color-lift',
} as const;

/**
 * Semantic tokens permitted to carry body text. Every one of these must clear
 * the AA body-text ratio on both surfaces above.
 */
export const bodyText = [
  '--color-fg-primary',
  '--color-fg-emphasis',
  '--color-fg-secondary',
  '--color-fg-muted',
  '--color-fg-identifier',
  '--color-fg-danger',
  '--color-nav-selected',
  '--color-status-2xx',
  '--color-status-3xx',
  '--color-status-4xx',
  '--color-status-5xx',
  '--color-status-pending',
] as const;

/**
 * Permitted for large text and UI components only. Iron misses AA for body
 * text by a margin small enough to look acceptable to someone with good
 * eyesight on a good screen, which is exactly why it needs a rule rather than
 * a judgement call. Where it is used, the meaning is also carried by something
 * other than the colour - a cursor, an aria-disabled attribute.
 */
export const largeTextOnly = ['--color-fg-disabled'] as const;

/**
 * Primitives that may never carry text of any size. There is deliberately no
 * semantic token that makes either of these available as a foreground colour;
 * the test asserts that absence rather than trusting it.
 */
export const neverText = ['--color-charcoal', '--color-graphite-hairline'] as const;

/** WCAG AA, normal text. */
export const AA_BODY_TEXT = 4.5;

/** WCAG AA, large text and UI components. */
export const AA_LARGE_TEXT = 3;