import {
  RETRY_AFTER_FALLBACK_SECONDS,
  fieldErrors,
  retryAfterSeconds,
  toProblem,
} from '@/lib/api/problem';

const respond = (status: number, statusText = '', headers: Record<string, string> = {}) =>
  new Response(null, { status, statusText, headers });

describe('toProblem (observed row 34)', () => {
  it('reads the application shape, errorCode, traceId and errors included', () => {
    const problem = toProblem(respond(422), {
      type: 'https://datatracker.ietf.org/doc/html/rfc9110#section-15.5.21',
      title: 'Unprocessable Entity',
      status: 422,
      detail: 'One or more validation errors occurred.',
      instance: 'POST /api/v1/auth/login',
      errorCode: 'Validation.General',
      traceId: '00-abc-def-01',
      errors: { Email: ["'Email' must not be empty."] },
    });

    expect(problem).toEqual({
      status: 422,
      title: 'Unprocessable Entity',
      detail: 'One or more validation errors occurred.',
      errorCode: 'Validation.General',
      traceId: '00-abc-def-01',
      errors: { Email: ["'Email' must not be empty."] },
    });
  });

  it('reads the framework shape, which has no detail and no errorCode', () => {
    const problem = toProblem(respond(403), {
      type: 'https://tools.ietf.org/html/rfc9110#section-15.5.4',
      title: 'Forbidden',
      status: 403,
      traceId: '00-abc-def-01',
    });

    expect(problem).toEqual({ status: 403, title: 'Forbidden', traceId: '00-abc-def-01' });
  });

  it('reads the rate-limiter shape, which has no errorCode and no traceId', () => {
    const problem = toProblem(respond(429), {
      title: 'Too Many Requests',
      status: 429,
      detail: 'Too many requests. Please try again later.',
    });

    expect(problem).not.toHaveProperty('errorCode');
    expect(problem).not.toHaveProperty('traceId');
    expect(problem).toMatchObject({ status: 429, title: 'Too Many Requests' });
  });

  it('titles a body that is not problem details from the status line', () => {
    expect(toProblem(respond(502, 'Bad Gateway'), '<html>edge error</html>')).toEqual({
      status: 502,
      title: 'Bad Gateway',
    });
    expect(toProblem(respond(413), undefined)).toEqual({ status: 413, title: 'HTTP 413' });
  });
});

describe('fieldErrors', () => {
  it('matches the API PascalCase keys case-insensitively (observed row 19)', () => {
    const problem = toProblem(respond(422), {
      title: 'Unprocessable Entity',
      errors: { Email: ['First.', 'Second.'] },
    });

    expect(fieldErrors(problem, 'email')).toEqual(['First.', 'Second.']);
    expect(fieldErrors(problem, 'password')).toEqual([]);
  });
});

describe('retryAfterSeconds', () => {
  it.each([
    ['60', 60],
    ['42', 42],
    [' 7 ', 7],
    ['Wed, 21 Oct 2026 07:28:00 GMT', RETRY_AFTER_FALLBACK_SECONDS],
    [undefined, RETRY_AFTER_FALLBACK_SECONDS],
  ])('Retry-After %s waits %i seconds', (header, seconds) => {
    const response = respond(429, '', header === undefined ? {} : { 'Retry-After': header });
    expect(retryAfterSeconds(response)).toBe(seconds);
  });
});
