import { API_BASE_URL } from '@/lib/api/client';
import { MOCK_ACCOUNTS } from '@/lib/testing/factories';

/**
 * Plain HTTP against the mock, for tests that assert on the wire: statuses,
 * headers and exact bodies. Feature tests go through the application instead.
 */
export function url(path: string): string {
  return `${API_BASE_URL.replace(/\/$/, '')}${path}`;
}

export function call(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url(path), { credentials: 'include', ...init });
}

/** A JSON body, with any headers the request also needs (the token, usually). */
export function json(body: unknown, headers: Record<string, string> = {}): RequestInit {
  return {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...headers },
  };
}

export interface Session {
  accessToken: string;
  auth: { Authorization: string };
}

export async function signIn(
  account: { email: string; password: string } = MOCK_ACCOUNTS.demo,
): Promise<Session> {
  const response = await call('/api/v1/auth/login', {
    method: 'POST',
    ...json({ email: account.email, password: account.password }),
  });
  if (response.status !== 200) {
    throw new Error(`sign-in as ${account.email} answered ${response.status}`);
  }
  const { accessToken } = (await response.json()) as { accessToken: string };
  return { accessToken, auth: { Authorization: `Bearer ${accessToken}` } };
}

export function refresh(cookie?: string): Promise<Response> {
  return call('/api/v1/auth/refresh', {
    method: 'POST',
    ...(cookie === undefined ? {} : { headers: { Cookie: cookie } }),
  });
}

/** The value of the refresh cookie a response sets, or null. */
export function refreshCookieOf(response: Response): string | null {
  const header = response.headers.get('Set-Cookie');
  const match = header?.match(/umapi_rt=([^;]*)/);
  return match ? (match[1] ?? '') : null;
}

export function claimsOf(accessToken: string): Record<string, unknown> {
  const payload = accessToken.split('.')[1] ?? '';
  const padded = payload.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  return JSON.parse(
    new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0))),
  ) as Record<string, unknown>;
}
