import { useEffect, useId, useRef, useState } from 'react';

import { toCurl } from '@/features/inspector/curl';
import { bodyText, classOf, durationOf, headerLines, pathOf } from '@/features/inspector/format';
import { clearCaptures, useCaptures, type Capture } from '@/lib/api/capture';
import { Button } from '@/ui/Button';
import { CodeWindow } from '@/ui/CodeWindow';
import { StatusDot, type ResponseClass } from '@/ui/StatusDot';

/**
 * The inspector (inventory section 3.8): every request this session sent, as
 * the transport recorded it (ADR 0014). Not a route. Docked at the bottom of
 * every screen behind the login, collapsed to one line showing the most recent
 * request, and expanded into the list and the request and response panes.
 *
 * Its open state and selection are this page's alone and never in the URL
 * (inventory section 5). Until a row is chosen the panes follow the most recent
 * request, so opening the inspector after an error lands on the response that
 * caused it. `Escape` closes it, after any open dialog (inventory section 4).
 */

export const EMPTY_COPY = 'No requests yet. Everything this console sends to the API appears here.';
export const WITHHELD_COPY =
  "Response headers not listed are withheld by the API's CORS policy, not absent.";
export const NOT_MODIFIED_BODY_COPY =
  'No body: a 304 carries none, and the console kept the copy it already held.';
export const NO_BODY_COPY = 'No body.';
export const PENDING_COPY = 'Waiting for the response.';
export const UNANSWERED_COPY = 'No response from the API.';
export const CANCELLED_COPY =
  'Cancelled by the console before an answer arrived: the screen that sent it no longer needed it.';
export const COPIED_COPY = 'Copied. Set TOKEN, and PASSWORD for a sign-in, before running it.';
export const COPY_REFUSED_COPY = 'The browser refused access to the clipboard.';

/** The selected row's left border, in its status colour (inventory section 3.8). */
const SELECTED_BORDER: Record<ResponseClass, string> = {
  '2xx': 'border-l-status-2xx',
  '3xx': 'border-l-status-3xx',
  '4xx': 'border-l-status-4xx',
  '5xx': 'border-l-status-5xx',
  pending: 'border-l-status-pending',
};

function Dot({ capture }: { capture: Capture }) {
  const { outcome } = capture;
  return (
    <StatusDot
      className="shrink-0"
      status={outcome.kind === 'response' ? outcome.response.status : undefined}
      unanswered={outcome.kind === 'unanswered'}
      cancelled={outcome.kind === 'cancelled'}
    />
  );
}

/** Status, method, path and duration: one request in one line. */
function Line({ capture }: { capture: Capture }) {
  return (
    <span className="flex min-w-0 items-center gap-app-2 font-mono text-app-meta">
      <Dot capture={capture} />
      <span className="shrink-0 text-fg-secondary">{capture.request.method}</span>
      <span className="min-w-0 truncate text-fg-primary">{pathOf(capture.request.url)}</span>
      <span className="shrink-0 tabular-nums text-fg-muted">{durationOf(capture)}</span>
    </span>
  );
}

function requestText({ request }: Capture): string {
  const sections = [headerLines(request.headers)];
  if (request.body !== null) sections.push(bodyText(request.body));
  return sections.filter((section) => section !== '').join('\n\n') || NO_BODY_COPY;
}

function responseTitle({ outcome }: Capture): string {
  if (outcome.kind === 'pending') return 'Response';
  if (outcome.kind === 'unanswered') return `No response · ${Math.round(outcome.durationMs)} ms`;
  if (outcome.kind === 'cancelled') return `Cancelled · ${Math.round(outcome.durationMs)} ms`;
  const { status, statusText } = outcome.response;
  return `${[status, statusText].filter(Boolean).join(' ')} · ${Math.round(outcome.durationMs)} ms`;
}

function responseText({ outcome }: Capture): string {
  if (outcome.kind === 'pending') return PENDING_COPY;
  if (outcome.kind === 'unanswered') return UNANSWERED_COPY;
  if (outcome.kind === 'cancelled') return CANCELLED_COPY;
  const { status, headers, body } = outcome.response;
  const empty = status === 304 ? NOT_MODIFIED_BODY_COPY : NO_BODY_COPY;
  return [headerLines(headers), body === null ? empty : bodyText(body)]
    .filter((section) => section !== '')
    .join('\n\n');
}

function Detail({ capture }: { capture: Capture }) {
  const [copied, setCopied] = useState('');
  const { request, outcome } = capture;

  async function copy() {
    try {
      await navigator.clipboard.writeText(toCurl(capture));
      setCopied(COPIED_COPY);
    } catch {
      setCopied(COPY_REFUSED_COPY);
    }
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-col gap-app-3 overflow-y-auto p-app-3">
      <div className="flex flex-wrap items-center gap-app-2">
        <Button onClick={() => void copy()}>Copy as curl</Button>
        <p role="status" className="text-app-meta text-fg-secondary">
          {copied}
        </p>
      </div>
      <CodeWindow
        title={`${request.method} ${pathOf(request.url)}`}
        truncatedAtKb={request.body?.truncated === true ? 64 : undefined}
      >
        {requestText(capture)}
      </CodeWindow>
      <CodeWindow
        title={responseTitle(capture)}
        truncatedAtKb={
          outcome.kind === 'response' && outcome.response.body?.truncated === true ? 64 : undefined
        }
      >
        {responseText(capture)}
      </CodeWindow>
      <p className="text-app-meta text-fg-muted">{WITHHELD_COPY}</p>
    </div>
  );
}

export function Inspector() {
  const captures = useCaptures();
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<number | null>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const latest = captures.at(-1);
  const selected = captures.find((capture) => capture.id === chosen) ?? latest;

  useEffect(() => {
    if (!open) return;
    // Captured on the document, so the inspector closes before a focused field
    // acts on the key - but never over an open dialog, which closes first.
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (document.querySelector('[aria-modal="true"]') !== null) return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      toggle.current?.focus();
    }
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open]);

  return (
    <section
      aria-label="Inspector"
      className="sticky bottom-0 z-40 border-t border-border-default bg-canvas"
    >
      <div className="flex min-h-[var(--size-row)] items-center gap-app-3 px-app-3">
        <Button
          ref={toggle}
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          onClick={() => setOpen((value) => !value)}
          className="shrink-0"
        >
          Inspector
        </Button>
        {latest === undefined ? null : <Line capture={latest} />}
      </div>

      {open ? (
        <div
          id={panelId}
          className="grid h-[50vh] grid-rows-[minmax(0,10rem)_minmax(0,1fr)] border-t border-border-default md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] md:grid-rows-1"
        >
          {selected === undefined ? (
            <p className="p-app-3 text-fg-secondary md:col-span-2">{EMPTY_COPY}</p>
          ) : (
            <>
              <div className="flex min-h-0 flex-col border-b border-border-default md:border-r md:border-b-0">
                <div className="flex items-center justify-between gap-app-2 px-app-3 py-app-1">
                  <h2 className="font-mono text-app-label text-fg-muted uppercase">
                    Requests · {captures.length}
                  </h2>
                  <Button
                    onClick={() => {
                      clearCaptures();
                      setChosen(null);
                    }}
                  >
                    Clear
                  </Button>
                </div>
                <ol aria-label="Requests" className="min-h-0 flex-1 overflow-y-auto">
                  {captures.toReversed().map((capture) => {
                    const current = capture.id === selected.id;
                    return (
                      <li key={capture.id}>
                        <button
                          type="button"
                          aria-current={current ? 'true' : undefined}
                          onClick={() => setChosen(capture.id)}
                          className={[
                            'flex w-full items-center border-l-2 px-app-3 py-app-1 text-left hover:bg-lift focus-visible:outline-offset-[-2px]',
                            current
                              ? `bg-lift ${SELECTED_BORDER[classOf(capture)]}`
                              : 'border-l-transparent',
                          ].join(' ')}
                        >
                          <Line capture={capture} />
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </div>
              <Detail key={selected.id} capture={selected} />
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
