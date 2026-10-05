/**
 * The class of an HTTP response. This is the only meaning "status" has in this
 * application, and the only component permitted to reach for the status
 * palette - see DESIGN-DECISIONS sections 5 and 10.
 *
 * Colour never carries the meaning alone. The dot is always accompanied by the
 * numeric code in JetBrains Mono, and by the class in words for anyone who
 * cannot see either, so the information survives colour blindness and a
 * monochrome screen equally.
 */

export type ResponseClass = '2xx' | '3xx' | '4xx' | '5xx' | 'pending';

/** Anything below 300 counts as success; the API returns no 1xx. */
export function responseClassOf(status: number | undefined): ResponseClass {
  if (status === undefined) return 'pending';
  if (status >= 500) return '5xx';
  if (status >= 400) return '4xx';
  if (status >= 300) return '3xx';
  return '2xx';
}

const MEANING: Record<ResponseClass, string> = {
  '2xx': 'success',
  '3xx': 'redirection',
  '4xx': 'client error',
  '5xx': 'server error',
  pending: 'pending',
};

const DOT: Record<ResponseClass, string> = {
  '2xx': 'bg-status-2xx',
  '3xx': 'bg-status-3xx',
  '4xx': 'bg-status-4xx',
  '5xx': 'bg-status-5xx',
  pending: 'bg-status-pending',
};

export interface StatusDotProps {
  /** Absent means the request is still in flight. */
  status?: number | undefined;
  /**
   * Nothing answered the request: offline, DNS, or a CORS refusal. There is no
   * code to show and no class to colour, so the dot stays neutral and the words
   * say what happened.
   */
  unanswered?: boolean | undefined;
  /**
   * The console cancelled the request before an answer arrived. Neutral too,
   * and named, so it is not read as a request the API failed to answer.
   */
  cancelled?: boolean | undefined;
  className?: string | undefined;
}

export function StatusDot({
  status,
  unanswered = false,
  cancelled = false,
  className,
}: StatusDotProps) {
  const responseClass = unanswered || cancelled ? 'pending' : responseClassOf(status);

  return (
    <span className={['inline-flex items-center gap-app-1', className].filter(Boolean).join(' ')}>
      <span aria-hidden="true" className={`size-2 rounded-pill ${DOT[responseClass]}`} />
      {unanswered ? (
        <span className="font-mono text-app-meta text-fg-muted">no response</span>
      ) : cancelled ? (
        <span className="font-mono text-app-meta text-fg-muted">cancelled</span>
      ) : status === undefined ? (
        <span className="font-mono text-app-meta text-fg-muted">pending</span>
      ) : (
        <>
          <span className="font-mono text-app-meta tabular-nums text-fg-secondary">{status}</span>
          <span className="sr-only">{MEANING[responseClass]}</span>
        </>
      )}
    </span>
  );
}
