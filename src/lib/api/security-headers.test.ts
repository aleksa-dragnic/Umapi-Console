import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { DEPLOYED_API_ORIGIN } from '@/lib/api/create-client';

/**
 * `public/_headers` is what Cloudflare Pages sends with every response of the
 * console (ADR 0015). Nothing in CI sees what Pages serves, so the file itself
 * is held to the decision here; the served headers are checked by hand after a
 * deploy. The file is also the fourth place the deployed origin is written
 * (ADR 0006 names three), and the first test keeps it on the same origin.
 */
function contentSecurityPolicy(): Map<string, string[]> {
  const file = readFileSync(resolve(process.cwd(), 'public', '_headers'), 'utf8');
  const prefix = 'Content-Security-Policy:';
  const line = file
    .split('\n')
    .map((candidate) => candidate.trim())
    .find((candidate) => candidate.startsWith(prefix));
  if (line === undefined) {
    throw new Error('public/_headers sends no Content-Security-Policy.');
  }
  const directives = new Map<string, string[]>();
  for (const directive of line.slice(prefix.length).split(';')) {
    const [name, ...sources] = directive.trim().split(/\s+/);
    if (name) {
      directives.set(name, sources);
    }
  }
  return directives;
}

describe('the console security headers (public/_headers)', () => {
  test('connect only to the deployed API, which the client also targets', () => {
    expect(contentSecurityPolicy().get('connect-src')).toEqual([DEPLOYED_API_ORIGIN]);
  });

  test('allow scripts and styles from the console itself only, and no framing', () => {
    const policy = contentSecurityPolicy();
    expect(policy.get('default-src')).toEqual(["'none'"]);
    expect(policy.get('script-src')).toEqual(["'self'"]);
    expect(policy.get('style-src')).toEqual(["'self'"]);
    expect(policy.get('frame-ancestors')).toEqual(["'none'"]);
  });
});
