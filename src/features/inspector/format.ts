import type { Capture, CapturedBody, Header } from '@/lib/api/capture';
import { responseClassOf, type ResponseClass } from '@/ui/StatusDot';

/** The path and query, which is what a reader scans for; the origin is always the API's. */
export function pathOf(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname + parsed.search;
  } catch {
    return url;
  }
}

/** Whole milliseconds, or nothing while the request is in flight. */
export function durationOf({ outcome }: Capture): string {
  return outcome.kind === 'pending' ? '' : `${Math.round(outcome.durationMs)} ms`;
}

/** The class a capture is coloured by. A request nothing answered, or one cancelled, has none. */
export function classOf({ outcome }: Capture): ResponseClass {
  return outcome.kind === 'response' ? responseClassOf(outcome.response.status) : 'pending';
}

/**
 * A body as JSON whenever it parses as JSON, whatever its media type:
 * `application/json`, `application/problem+json` and the HATEOAS vendor type
 * all occur (observed rows 33, 34). Anything else, and a body cut short, as it
 * arrived.
 */
export function bodyText(body: CapturedBody): string {
  if (body.truncated) return body.text;
  try {
    return JSON.stringify(JSON.parse(body.text), null, 2);
  } catch {
    return body.text;
  }
}

export function headerLines(headers: readonly Header[]): string {
  return headers.map(([name, value]) => `${name}: ${value}`).join('\n');
}
