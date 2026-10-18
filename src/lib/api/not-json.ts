import type { Middleware } from 'openapi-fetch';

/**
 * A success whose body is not JSON, where JSON was expected: something other
 * than the API answered - a proxy's page, an edge's error - or the API broke
 * its contract. Inventory section 2.8 calls it a server error. openapi-fetch
 * would fail to parse it and throw a SyntaxError, which carries no status and
 * reads as no answer at all, so the response is stopped here, with its status.
 */
export class NotJsonError extends Error {
  readonly status: number;
  readonly statusText: string;

  constructor(status: number, statusText: string) {
    super('The response was not JSON.');
    this.name = 'NotJsonError';
    this.status = status;
    this.statusText = statusText;
  }
}

export const NOT_JSON_TITLE = 'The response was not JSON';

export const refuseNotJson: Middleware = {
  onResponse({ request, response }) {
    if (!response.ok || response.status === 204 || request.method === 'HEAD') return undefined;
    if (response.headers.get('Content-Length') === '0') return undefined;
    const type = response.headers.get('Content-Type') ?? '';
    if (/json/i.test(type)) return undefined;
    throw new NotJsonError(response.status, response.statusText);
  },
};
