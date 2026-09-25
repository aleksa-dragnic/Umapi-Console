/**
 * Reading an error response. The API answers in three problem-details shapes
 * (observed row 34), and only `status` and `title` are present in all of them,
 * so nothing here depends on any other field being there. A body that is not
 * JSON at all - an edge error page, an empty 413 - still becomes a problem,
 * titled from the status line.
 */

export interface Problem {
  status: number;
  title: string;
  /** Application shape only. */
  errorCode?: string;
  /** Application and rate-limiter shapes. */
  detail?: string;
  /** Application and framework shapes. */
  traceId?: string;
  /** 422 only. Keys are PascalCase (row 19). */
  errors?: Record<string, string[]>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function fieldMessages(value: unknown): Record<string, string[]> | undefined {
  if (!isRecord(value)) return undefined;
  const errors: Record<string, string[]> = {};
  for (const [key, messages] of Object.entries(value)) {
    if (Array.isArray(messages)) {
      errors[key] = messages.filter((m): m is string => typeof m === 'string');
    } else if (typeof messages === 'string') {
      errors[key] = [messages];
    }
  }
  return Object.keys(errors).length > 0 ? errors : undefined;
}

/** `body` is whatever the client parsed from the response, or undefined. */
export function toProblem(response: Response, body: unknown): Problem {
  const fields = isRecord(body) ? body : {};
  const problem: Problem = {
    status: response.status,
    title: text(fields['title']) ?? (response.statusText || `HTTP ${response.status}`),
  };
  const errorCode = text(fields['errorCode']);
  const detail = text(fields['detail']);
  const traceId = text(fields['traceId']);
  const errors = fieldMessages(fields['errors']);
  if (errorCode !== undefined) problem.errorCode = errorCode;
  if (detail !== undefined) problem.detail = detail;
  if (traceId !== undefined) problem.traceId = traceId;
  if (errors !== undefined) problem.errors = errors;
  return problem;
}

/**
 * The messages for one field. Matched case-insensitively, because the API's
 * keys are PascalCase and the console's field names are not (row 19).
 */
export function fieldErrors(problem: Problem, field: string): string[] {
  const wanted = field.toLowerCase();
  for (const [key, messages] of Object.entries(problem.errors ?? {})) {
    if (key.toLowerCase() === wanted) return messages;
  }
  return [];
}

/**
 * The wait a 429 asks for, in seconds. The API sends `Retry-After` as a number
 * of seconds (row 28), and falls back to 60 itself (row 52); the console uses
 * the same fallback when the header is absent or is not a number.
 */
export const RETRY_AFTER_FALLBACK_SECONDS = 60;

export function retryAfterSeconds(response: Response): number {
  const header = response.headers.get('Retry-After');
  if (header === null || !/^\d+$/.test(header.trim())) {
    return RETRY_AFTER_FALLBACK_SECONDS;
  }
  return Number(header.trim());
}
