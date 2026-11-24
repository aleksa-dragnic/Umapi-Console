import { Link } from 'react-router';

import directory from '@/features/landing/directory.webp';
import { AppMark } from '@/ui/AppMark';
import { Card } from '@/ui/Card';
import { CodeWindow } from '@/ui/CodeWindow';

/**
 * The call to action is a ghost control with the strong border, the loudest a
 * control gets here: there is no filled button (DESIGN-DECISIONS section 2).
 *
 * The public page at `/` (inventory section 3.14, ADR 0018): what the console
 * is, before a sign-in form. It makes no request to the API - the free instance
 * may be asleep, and a first visit should not wait for it - so it does not know
 * whether a session is live, only whether this browser had one (ADR 0017); the
 * route decides the call to action and passes it in.
 */

export const LANDING_TITLE = 'An admin console that does not hide HTTP';
export const AUTHOR = 'Aleksa Dragnić';

const AUTHOR_URL = 'https://github.com/aleksa-dragnic';
const CONSOLE_REPO = 'https://github.com/aleksa-dragnic/Umapi-Console';
const API_REPO = 'https://github.com/aleksa-dragnic/UserManagementAPI';

const FEATURES = [
  {
    label: 'Inspector',
    title: 'Every request, as it went',
    body: 'Method, path, status, timing, headers and body, and Copy as curl with the token left as $TOKEN.',
  },
  {
    label: 'Conditional reads',
    title: 'A 304 says 304',
    body: 'Every repeated read sends its ETag back; every write sends the version it read, and a stale one is a conflict.',
  },
  {
    label: 'Permissions',
    title: 'A refusal says why',
    body: 'Each write the account may not make stays visible, disabled, with the permission it needs.',
  },
] as const;

const LINK =
  'underline-offset-4 hover:underline focus-visible:underline text-fg-primary hover:text-fg-emphasis';
const ACTION =
  'inline-flex h-[var(--size-control)] items-center justify-center rounded-control border px-app-3 text-app-body transition-colors duration-[var(--duration-hover)] ease-standard';

export interface LandingAction {
  label: string;
  to: string;
}

export function LandingPage({ action }: { action: LandingAction }) {
  return (
    <div
      data-density="editorial"
      className="min-h-screen p-[var(--density-pad)] text-[length:var(--density-body)]"
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-editorial-1">
        <header className="flex items-center justify-between gap-app-3">
          <span className="flex items-center gap-app-2">
            <AppMark />
            <span className="text-app-body font-semibold text-fg-emphasis">Umapi Console</span>
          </span>
          <nav aria-label="Source code" className="flex gap-app-3 font-mono text-app-meta">
            <a className={LINK} href={CONSOLE_REPO}>
              Console
            </a>
            <a className={LINK} href={API_REPO}>
              API
            </a>
          </nav>
        </header>

        <main className="flex flex-col gap-editorial-1">
          <section aria-labelledby="landing-title" className="flex flex-col gap-app-3">
            <h1
              id="landing-title"
              tabIndex={-1}
              className="max-w-3xl font-display text-display-sm text-fg-emphasis"
            >
              {LANDING_TITLE}
            </h1>
            <p className="max-w-2xl text-editorial-lg text-fg-secondary">
              Users, roles and permissions on a .NET 10 API, administered from a React console that
              shows what happened on the wire: every request in the inspector, every conditional
              read, every refusal with its reason.
            </p>
            <div className="flex flex-wrap gap-app-2">
              <Link to={action.to} className={`${ACTION} border-border-strong text-fg-emphasis`}>
                {action.label}
              </Link>
              <a
                href={CONSOLE_REPO}
                className={`${ACTION} border-border-default text-fg-emphasis hover:border-border-strong`}
              >
                Read the code
              </a>
            </div>
          </section>

          <figure className="overflow-hidden rounded-card border border-border-default">
            <img
              src={directory}
              width={1440}
              height={900}
              alt="The console's user directory: each user's email, first and last name, and status - Active, Pending, Locked or Deactivated."
              className="block h-auto w-full"
              decoding="async"
            />
          </figure>

          <section aria-labelledby="landing-features" className="flex flex-col gap-app-3">
            <h2 id="landing-features" className="text-app-subtitle text-fg-emphasis">
              What it makes visible
            </h2>
            <ul className="grid grid-cols-1 gap-app-3 md:grid-cols-3">
              {FEATURES.map((feature) => (
                <li key={feature.label} className="flex">
                  <Card className="flex w-full flex-col gap-app-1">
                    <p className="font-mono text-app-label uppercase text-fg-muted">
                      {feature.label}
                    </p>
                    <h3 className="text-app-body font-semibold text-fg-emphasis">
                      {feature.title}
                    </h3>
                    <p className="text-app-body text-fg-secondary">{feature.body}</p>
                  </Card>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="landing-wire" className="flex flex-col gap-app-3">
            <h2 id="landing-wire" className="text-app-subtitle text-fg-emphasis">
              On the wire
            </h2>
            <p className="max-w-2xl text-app-body text-fg-secondary">
              Returning to a page of the directory. The console sends the tag it holds, the API
              answers that nothing changed, and the footer says so instead of pretending to a 200.
            </p>
            <CodeWindow title="GET /api/v1/users?PageNumber=2">
              {[
                'If-None-Match: "tmSGsZXR7yA_F1OKSRWdRQQ3OlqzF75GYwJLTCMMPtg"',
                '',
                'HTTP/1.1 304 Not Modified',
                'ETag: "tmSGsZXR7yA_F1OKSRWdRQQ3OlqzF75GYwJLTCMMPtg"',
                'Cache-Control: private, no-cache',
              ].join('\n')}
            </CodeWindow>
          </section>
        </main>

        <footer className="flex flex-wrap justify-between gap-app-2 border-t border-border-default pt-app-3 font-mono text-app-meta text-fg-secondary">
          <p>
            Built by{' '}
            <a className={LINK} href={AUTHOR_URL}>
              {AUTHOR}
            </a>
          </p>
          <p>MIT licence</p>
        </footer>
      </div>
    </div>
  );
}
