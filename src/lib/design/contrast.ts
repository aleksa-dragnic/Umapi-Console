/**
 * Parses the design tokens and computes WCAG contrast ratios from them.
 *
 * The stylesheet is the single source of every colour value; this module holds
 * none. A token renamed in docs/tokens.css fails here immediately instead of
 * silently measuring a stale number.
 *
 * Nothing here touches the filesystem. The caller supplies the stylesheet as a
 * string - the test imports it with Vite's ?raw - so these functions behave
 * identically in every environment.
 */

export type Declarations = ReadonlyMap<string, string>;

const DECLARATION = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi;
const VAR_REFERENCE = /^var\(\s*(--[a-z0-9-]+)\s*\)$/i;
const COLOUR_VALUE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Every custom property declared in the stylesheet, by name. */
export function readDeclarations(source: string): Declarations {
  const declarations = new Map<string, string>();
  for (const match of source.matchAll(DECLARATION)) {
    const name = match[1];
    const value = match[2];
    if (name !== undefined && value !== undefined) {
      declarations.set(name, value.trim());
    }
  }
  return declarations;
}

/**
 * Follows a semantic token through the tier it points at until a literal
 * colour is reached. Throws rather than returning a fallback: a token that
 * does not resolve is a defect, and a fallback would hide it.
 */
export function resolveColour(token: string, declarations: Declarations): string {
  const seen = new Set<string>();
  let current = token;

  for (;;) {
    if (seen.has(current)) {
      throw new Error(`${token} resolves in a cycle, reached ${current} twice`);
    }
    seen.add(current);

    const value = declarations.get(current);
    if (value === undefined) {
      throw new Error(`${current} is not declared in docs/tokens.css`);
    }

    const reference = VAR_REFERENCE.exec(value);
    if (reference === null) {
      if (!COLOUR_VALUE.test(value)) {
        throw new Error(`${token} resolves to "${value}", which is not a colour`);
      }
      return value.toLowerCase();
    }

    const next = reference[1];
    if (next === undefined) {
      throw new Error(`${current} declares a malformed var() reference`);
    }
    current = next;
  }
}

function channel(value: number): number {
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance, WCAG 2.1 definition. */
export function luminance(colour: string): number {
  const digits = colour.slice(1);
  const expanded = digits.length === 3 ? digits.replace(/./g, (digit) => digit + digit) : digits;
  const component = (at: number): number => channel(parseInt(expanded.slice(at, at + 2), 16) / 255);
  return 0.2126 * component(0) + 0.7152 * component(2) + 0.0722 * component(4);
}

/** Contrast ratio between two literal colours, always at least 1. */
export function contrastRatio(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}