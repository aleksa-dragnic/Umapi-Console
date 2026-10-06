import type { Response } from '@playwright/test';

// Matched by path, not by origin: the API's origin is written in the
// repository's four places (ADR 0006, ADR 0015) and nowhere in the live suite.

/** How long the first answer of a spec may take: a cold start (rows 35-37). */
export const COLD_START_MS = 75_000;

function isAuthCall(response: Response, path: string): boolean {
  return response.request().method() === 'POST' && new URL(response.url()).pathname === path;
}

export const isRefresh = (response: Response): boolean =>
  isAuthCall(response, '/api/v1/auth/refresh');

export const isLogin = (response: Response): boolean => isAuthCall(response, '/api/v1/auth/login');

export const isLogout = (response: Response): boolean =>
  isAuthCall(response, '/api/v1/auth/logout');
