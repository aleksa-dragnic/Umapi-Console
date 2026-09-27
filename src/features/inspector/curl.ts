import {
  PASSWORD_PLACEHOLDER,
  REFRESH_TOKEN_PLACEHOLDER,
  TOKEN_PLACEHOLDER,
  type Capture,
} from '@/lib/api/capture';

/**
 * Copy as `curl` (inventory section 3.8): a command a POSIX shell runs as it
 * stands, with the credentials the record never held left as shell variables -
 * `$TOKEN` for the access token, `$PASSWORD` for a password in a body. A copied
 * credential in a reviewer's clipboard is a defect, not a feature.
 *
 * The refresh cookie is the browser's: a page cannot read it, so it is not in
 * the record and not in the command.
 */

// One pass, longest first: `$TOKEN` is also the end of `$REFRESH_TOKEN`.
const VARIABLE = new RegExp(
  [REFRESH_TOKEN_PLACEHOLDER, PASSWORD_PLACEHOLDER, TOKEN_PLACEHOLDER]
    .map((name) => name.replace('$', '\\$'))
    .join('|'),
  'g',
);

/**
 * One shell word. Everything is single-quoted, so nothing in it is expanded,
 * except the placeholders, which are closed out of the quotes and double-quoted
 * so the shell substitutes them.
 */
export function shellWord(value: string): string {
  const word = `'${value.replace(/'/g, `'\\''`)}'`.replace(VARIABLE, (name) => `'"${name}"'`);
  return word.replace(/^''(?=.)/, '').replace(/(?<=.)''$/, '');
}

export function toCurl({ request }: Capture): string {
  const parts = [`curl -X ${request.method} ${shellWord(request.url)}`];
  for (const [name, value] of request.headers) {
    parts.push(`-H ${shellWord(`${name}: ${value}`)}`);
  }
  if (request.body !== null) {
    parts.push(`--data-raw ${shellWord(request.body.text)}`);
  }
  return parts.join(' \\\n  ');
}
