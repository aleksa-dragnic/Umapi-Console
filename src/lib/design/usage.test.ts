import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/**
 * Where a colour may appear (ADR 0004, docs/DESIGN-DECISIONS.md section 10).
 * Components use tier 2 tokens only, never a literal value or a tier 1
 * primitive, and the HTTP status colours belong to the two places that render
 * a response. The tier 1 names are read from docs/tokens.css, so a primitive
 * added there is covered here without a second list.
 *
 * Scanned: every .ts and .tsx file under src/, except tests, the mock and
 * src/lib/design itself, which names tokens in order to assert them.
 */

const ROOT = process.cwd();
const SRC = resolve(ROOT, 'src');

/** The only files that may use the status tokens. */
const STATUS_ALLOWED = ['src/ui/StatusDot.tsx', 'src/features/inspector/Inspector.tsx'];

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

function scanned(): Array<{ file: string; text: string }> {
  return sources(SRC)
    .map((path) => relative(ROOT, path).replace(/\\/g, '/'))
    .filter(
      (file) =>
        !/\.test\.tsx?$/.test(file) &&
        !file.startsWith('src/lib/testing/') &&
        !file.startsWith('src/lib/design/') &&
        file !== 'src/setupTests.ts' &&
        !file.endsWith('.d.ts'),
    )
    .map((file) => ({ file, text: readFileSync(resolve(ROOT, file), 'utf8') }));
}

function tierOneNames(): string[] {
  const css = readFileSync(resolve(ROOT, 'docs', 'tokens.css'), 'utf8');
  const start = css.indexOf('Tier 1');
  const end = css.indexOf('Tier 2');
  if (start < 0 || end < start) throw new Error('docs/tokens.css has no tier 1 block.');
  return [...css.slice(start, end).matchAll(/--color-([a-z0-9-]+):/g)].map(
    (match) => match[1] ?? '',
  );
}

function offenders(pattern: RegExp, files = scanned()): string[] {
  return files.flatMap(({ file, text }) =>
    text
      .split('\n')
      .flatMap((line, index) =>
        [...line.matchAll(pattern)].map((match) => `${file}:${index + 1} ${match[0]}`),
      ),
  );
}

describe('where a colour may appear (ADR 0004)', () => {
  it('scans the source it is meant to', () => {
    const files = scanned().map(({ file }) => file);
    expect(files).toContain('src/ui/StatusDot.tsx');
    expect(files).toContain('src/features/users/DetailScreen.tsx');
    expect(tierOneNames()).toContain('signal-blue');
  });

  it('no literal hex colour', () => {
    // A hex colour as it appears in a class or a style: after a quote, a space,
    // a colon, a bracket or a parenthesis.
    expect(
      offenders(/(?<=["'`\s:[(])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g),
    ).toEqual([]);
  });

  it('no tier 1 token, as a utility class or a custom property', () => {
    const names = tierOneNames().join('|');
    const utility = new RegExp(`(?<![\\w-])[a-z]+(?:-[a-z]+)?-(?:${names})(?![\\w-])`, 'g');
    const property = new RegExp(`--color-(?:${names})(?![\\w-])`, 'g');
    expect(offenders(utility)).toEqual([]);
    expect(offenders(property)).toEqual([]);
  });

  it('no Tailwind default palette and no literal colour function: tier 2 names only', () => {
    const palette =
      'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
    expect(
      offenders(new RegExp(`(?<![\\w-])[a-z]+(?:-[a-z]+)?-(?:${palette})-\\d{2,3}\\b`, 'g')),
    ).toEqual([]);
    expect(offenders(/\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color-mix)\(/g)).toEqual([]);
  });

  it('the status colours only where a response is rendered', () => {
    const elsewhere = scanned().filter(({ file }) => !STATUS_ALLOWED.includes(file));
    expect(offenders(/status-(?:2xx|3xx|4xx|5xx|pending)/g, elsewhere)).toEqual([]);
  });
});
