import type { components } from '@/lib/api/schema';
import { createApiClient } from '@/lib/api/create-client';

/**
 * The auth endpoints as the console calls them: build plan section 3.2, the
 * contract the API adopts in M5. The generated schema still describes today's
 * API - four token fields and a refresh token in the request body (observed
 * rows 1 and 6) - so these three paths are typed here instead, and the mock
 * implements the same contract. When M5 regenerates `schema.d.ts` from the
 * changed API, this file is deleted and the calls move to `api`.
 * See docs/adr/0007-refresh-token-in-an-httponly-cookie.md.
 */

type Json<T> = { 'application/json': T };

interface NoParameters {
  query?: never;
  header?: never;
  path?: never;
  cookie?: never;
}

interface Answer<T> {
  headers: { [name: string]: unknown };
  content: Json<T>;
}

interface NoContent {
  headers: { [name: string]: unknown };
  content?: never;
}

/** Section 3.2: the access token and its expiry, nothing else. */
export interface AccessTokenResponse {
  accessToken: string;
  accessTokenExpiresAtUtc: string;
}

export type LoginRequest = components['schemas']['LoginRequest'];

type ProblemBody = components['schemas']['ProblemDetails'];

export interface AuthContractPaths {
  '/api/v1/auth/login': {
    parameters: NoParameters;
    post: {
      parameters: NoParameters;
      requestBody: { content: Json<LoginRequest> };
      responses: { 200: Answer<AccessTokenResponse>; default: Answer<ProblemBody> };
    };
  };
  /** The cookie is the credential; the request has no body. */
  '/api/v1/auth/refresh': {
    parameters: NoParameters;
    post: {
      parameters: NoParameters;
      requestBody?: never;
      responses: { 200: Answer<AccessTokenResponse>; default: Answer<ProblemBody> };
    };
  };
  '/api/v1/auth/logout': {
    parameters: NoParameters;
    post: {
      parameters: NoParameters;
      requestBody?: never;
      responses: { 204: NoContent; default: Answer<ProblemBody> };
    };
  };
}

/** The client for the three auth calls, configured exactly like `api`. */
export const authApi = createApiClient<AuthContractPaths>();
