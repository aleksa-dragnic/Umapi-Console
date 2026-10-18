import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { DEPLOYED_API_ORIGIN } from '@/lib/api/create-client';

/**
 * `public/_headers` is what Cloudflare Pages sends with every response of the
 * console (ADR 0015). This holds the file to the decision, header by header;
 * `e2e/csp.spec.ts` runs a session under its policy in a browser, and the
 * weekly `headers` workflow compares what Pages actually serves with it. The
 * file is also the fourth place the deployed origin is written (ADR 0006 names
 * three), and the first test keeps it on the same origin.
 */
function lines(): string[] {
  return readFileSync(resolve(process.cwd(), 'public', '_headers'), 'utf8').split('\n');
}

/** The header lines under one path rule, as written, `!` removals included. */
function headersFor(path: string): string[] {
  const all = lines();
  const start = all.findIndex((line) => line.trim() === path);
  if (start < 0) throw new Error(`public/_headers has no rule for ${path}.`);
  const rule: string[] = [];
  for (const line of all.slice(start + 1)) {
    if (!/^\s+\S/.test(line)) break;
    rule.push(line.trim());
  }
  return rule;
}

function header(path: string, name: string): string | undefined {
  const prefix = `${name}:`;
  return headersFor(path)
    .find((line) => line.startsWith(prefix))
    ?.slice(prefix.length)
    .trim();
}

function contentSecurityPolicy(): Map<string, string[]> {
  const value = header('/*', 'Content-Security-Policy');
  if (value === undefined) throw new Error('public/_headers sends no Content-Security-Policy.');
  const directives = new Map<string, string[]>();
  for (const directive of value.split(';')) {
    const [name, ...sources] = directive.trim().split(/\s+/);
    if (name) directives.set(name, sources);
  }
  return directives;
}

describe('the console security headers (public/_headers)', () => {
  test('send exactly the documented set on every response', () => {
    expect(headersFor('/*').map((line) => line.slice(0, line.indexOf(':')))).toEqual([
      'Content-Security-Policy',
      'Strict-Transport-Security',
      'X-Content-Type-Options',
      'X-Frame-Options',
      'Referrer-Policy',
      'Permissions-Policy',
      'Cross-Origin-Opener-Policy',
      'Cross-Origin-Resource-Policy',
    ]);
  });

  test('connect only to the deployed API, which the client also targets', () => {
    expect(contentSecurityPolicy().get('connect-src')).toEqual([DEPLOYED_API_ORIGIN]);
  });

  test('allow scripts and styles from the console itself only, and no framing', () => {
    const policy = contentSecurityPolicy();
    expect(policy.get('default-src')).toEqual(["'none'"]);
    expect(policy.get('script-src')).toEqual(["'self'"]);
    expect(policy.get('style-src')).toEqual(["'self'"]);
    expect(policy.get('frame-ancestors')).toEqual(["'none'"]);
    expect(policy.get('worker-src')).toEqual(["'none'"]);
    expect(policy.get('base-uri')).toEqual(["'none'"]);
    expect(policy.get('form-action')).toEqual(["'none'"]);
  });

  test('allow images from the console itself, for the favicon', () => {
    expect(contentSecurityPolicy().get('img-src')).toEqual(["'self'"]);
  });

  test('require Trusted Types, and allow no policy to create them', () => {
    const policy = contentSecurityPolicy();
    expect(policy.get('require-trusted-types-for')).toEqual(["'script'"]);
    expect(policy.get('trusted-types')).toEqual(["'none'"]);
  });

  test('pin HTTPS for a year, subdomains included', () => {
    expect(header('/*', 'Strict-Transport-Security')).toBe('max-age=31536000; includeSubDomains');
  });

  test('refuse sniffing, framing, the referrer and every browser feature', () => {
    expect(header('/*', 'X-Content-Type-Options')).toBe('nosniff');
    expect(header('/*', 'X-Frame-Options')).toBe('DENY');
    expect(header('/*', 'Referrer-Policy')).toBe('no-referrer');
    const features = (header('/*', 'Permissions-Policy') ?? '').split(',').map((f) => f.trim());
    expect(features.length).toBeGreaterThan(0);
    for (const feature of features) expect(feature).toMatch(/^[a-z-]+=\(\)$/);
    expect(features).toEqual(
      expect.arrayContaining(['camera=()', 'microphone=()', 'geolocation=()']),
    );
  });

  test('isolate the window and keep resources to the console, the preview image excepted', () => {
    expect(header('/*', 'Cross-Origin-Opener-Policy')).toBe('same-origin');
    expect(header('/*', 'Cross-Origin-Resource-Policy')).toBe('same-origin');
    expect(headersFor('/og.png')).toEqual([
      '! Cross-Origin-Resource-Policy',
      'Cross-Origin-Resource-Policy: cross-origin',
    ]);
  });

  test('cache the hashed assets for a year, as immutable', () => {
    expect(headersFor('/assets/*')).toEqual(['Cache-Control: public, max-age=31536000, immutable']);
  });
});
