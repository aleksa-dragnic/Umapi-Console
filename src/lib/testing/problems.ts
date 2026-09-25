import { HttpResponse } from 'msw';

/**
 * The three problem-details shapes the instance answers with (row 34). Only
 * `status` and `title` are common to all three, which is why the console relies
 * on nothing else.
 */

const PROBLEM_JSON = { 'Content-Type': 'application/problem+json' };

const APPLICATION_TYPES: Record<number, string> = {
  400: 'https://datatracker.ietf.org/doc/html/rfc9110#section-15.5.1',
  401: 'https://datatracker.ietf.org/doc/html/rfc9110#section-15.5.2',
  404: 'https://datatracker.ietf.org/doc/html/rfc9110#section-15.5.5',
  409: 'https://datatracker.ietf.org/doc/html/rfc9110#section-15.5.10',
  422: 'https://datatracker.ietf.org/doc/html/rfc9110#section-15.5.21',
};

const TITLES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
};

function traceId(): string {
  const hex = (length: number) =>
    Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `00-${hex(32)}-${hex(16)}-01`;
}

/** `instance` is the method and the path, as row 58 shows it. */
export function instanceOf(request: Request): string {
  return `${request.method} ${new URL(request.url).pathname}`;
}

/** Application shape: rows 5, 7, 19, 58. `errors` only on 422. */
export function applicationProblem(
  request: Request,
  status: number,
  errorCode: string,
  detail: string,
  errors?: Record<string, string[]>,
  headers: Record<string, string> = {},
) {
  return HttpResponse.json(
    {
      type: APPLICATION_TYPES[status] ?? APPLICATION_TYPES[400],
      title: TITLES[status] ?? 'Bad Request',
      status,
      detail,
      instance: instanceOf(request),
      errorCode,
      traceId: traceId(),
      ...(errors ? { errors } : {}),
    },
    { status, headers: { ...PROBLEM_JSON, ...headers } },
  );
}

/** Framework shape: 401 from a missing or invalid token, and 403 (rows 10, 27). */
export function frameworkProblem(request: Request, status: 401 | 403) {
  return HttpResponse.json(
    {
      type: `https://tools.ietf.org/html/rfc9110#section-15.5.${status === 401 ? 2 : 4}`,
      title: TITLES[status],
      status,
      instance: instanceOf(request),
      traceId: traceId(),
    },
    { status, headers: PROBLEM_JSON },
  );
}

/** Rate-limiter shape: no `errorCode`, no `traceId`; `Retry-After` in seconds (row 28). */
export function rateLimitProblem(request: Request, retryAfterSeconds: number) {
  return HttpResponse.json(
    {
      type: 'https://tools.ietf.org/html/rfc6585#section-4',
      title: TITLES[429],
      status: 429,
      // Wording not measured.
      detail: 'Too many requests. Try again later.',
      instance: instanceOf(request),
    },
    { status: 429, headers: { ...PROBLEM_JSON, 'Retry-After': String(retryAfterSeconds) } },
  );
}

/** Row 19 and its family (row 49): `Validation.*` is 422. */
export function validationProblem(request: Request, errors: Record<string, string[]>) {
  return applicationProblem(
    request,
    422,
    'Validation.General',
    'One or more validation errors occurred.',
    errors,
  );
}
