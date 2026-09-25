import type { paths } from '@/lib/api/schema';
import { API_BASE_URL } from '@/lib/api/client';

/**
 * A handler URL from a generated path, so a path the document renames breaks
 * the type check instead of silently never matching.
 */
export function endpoint(path: keyof paths): string {
  return `${API_BASE_URL.replace(/\/$/, '')}${path.replace(/\{(\w+)\}/g, ':$1')}`;
}

export function origin(path: string): string {
  return `${API_BASE_URL.replace(/\/$/, '')}${path}`;
}

/**
 * Row 64: the document names query parameters in PascalCase, and rows 13-19
 * were measured with camelCase: binding ignores case, so the mock does too.
 */
export function queryParam(url: URL, name: string): string | null {
  const wanted = name.toLowerCase();
  for (const [key, value] of url.searchParams) {
    if (key.toLowerCase() === wanted) {
      return value;
    }
  }
  return null;
}

async function sha256Base64url(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  let binary = '';
  new Uint8Array(digest).forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Rows 22 and 44: the tag is a hash of the serialized body and the pagination
 * header, and the deployed instance serves it weak.
 */
export async function weakETag(body: string, pagination = ''): Promise<string> {
  return `W/"${await sha256Base64url(body + pagination)}"`;
}

/** Row 44: `If-None-Match` is compared weakly. */
export function matchesIfNoneMatch(request: Request, etag: string): boolean {
  const header = request.headers.get('If-None-Match');
  if (!header) {
    return false;
  }
  const strip = (tag: string) => tag.trim().replace(/^W\//, '');
  return header.split(',').some((tag) => tag.trim() === '*' || strip(tag) === strip(etag));
}

// Row 22. `Vary` is left out: a browser cannot read it cross-origin (row 53).
export const CACHE_HEADERS = { 'Cache-Control': 'private, no-cache' };

// Row 30.
export const VERSION_HEADERS = { 'api-supported-versions': '1.0, 2.0' };

export async function readJson(request: Request): Promise<unknown> {
  try {
    return (await request.json()) as unknown;
  } catch {
    return null;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function stringField(body: unknown, name: string): string | undefined {
  if (!isRecord(body)) {
    return undefined;
  }
  const value = body[name];
  return typeof value === 'string' ? value : undefined;
}
