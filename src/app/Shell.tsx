import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';

import { ErrorBoundary } from '@/app/ErrorBoundary';
import { SESSION_PATH, SignOutButton } from '@/features/auth';
import { Inspector } from '@/features/inspector';
import { ROLES_PATH, USERS_PATH } from '@/features/users';
import { useAccessToken } from '@/lib/api/access-token';
import { useCaptures } from '@/lib/api/capture';
import { decodeClaims } from '@/lib/api/claims';
import { useOffline } from '@/lib/api/connection';
import { COLD_START_AFTER_MS, ColdStartNotice } from '@/ui/ColdStartNotice';
import { useAfter } from '@/ui/useAfter';

/**
 * The shell around every screen behind the login: the header with the
 * navigation and the account, the cross-cutting `offline` and `cold-start`
 * lines beneath it (inventory sections 2.1, 2.2), the error boundary around
 * the screen (section 3.11), and the inspector docked at the bottom (section
 * 3.8). Sign-in, boot and `404` have none of it.
 *
 * On every change of route, focus goes to the new screen's `h1` (section 4) -
 * unless the screen has already placed it inside its `main`, as the directory
 * does for the row that was opened and the detail does for its heading.
 */

export const OFFLINE_COPY = 'No connection. The console cannot reach the API.';

const NAVIGATION = [
  { to: USERS_PATH, label: 'Users' },
  { to: ROLES_PATH, label: 'Roles' },
  { to: SESSION_PATH, label: 'Session' },
] as const;

function navClass({ isActive }: { isActive: boolean }): string {
  return [
    'inline-flex h-[var(--size-control)] items-center border-b-2 transition-colors duration-[var(--duration-hover)] ease-standard',
    isActive
      ? 'border-nav-selected text-fg-emphasis'
      : 'border-transparent text-fg-secondary hover:text-fg-primary',
  ].join(' ');
}

/**
 * Section 2.1, once per session: the first request still pending after
 * 1200 ms brings the line, which stays until nothing is pending; a later slow
 * request does not bring it back. The shell is mounted once per session, so its
 * state is the session's.
 */
function ColdStartLine() {
  const pending = useCaptures().some(({ outcome }) => outcome.kind === 'pending');
  const [phase, setPhase] = useState<'watching' | 'shown' | 'done'>('watching');
  const slow = useAfter(COLD_START_AFTER_MS, pending && phase === 'watching');

  if (phase === 'watching' && slow) setPhase('shown');
  if (phase === 'shown' && !pending) setPhase('done');

  if (phase !== 'shown') return null;
  return (
    <div className="px-app-4 pb-app-2">
      <ColdStartNotice pending afterMs={0} />
    </div>
  );
}

export function Shell() {
  const { pathname } = useLocation();
  const token = useAccessToken();
  const email = token === null ? null : decodeClaims(token.value)?.all['email'];
  const offline = useOffline();
  const client = useQueryClient();

  useEffect(() => {
    // Section 2.2: when the network is back, the screen reads again.
    function reconnect() {
      void client.refetchQueries({ type: 'active' });
    }
    window.addEventListener('online', reconnect);
    return () => window.removeEventListener('online', reconnect);
  }, [client]);

  useEffect(() => {
    const main = document.querySelector('main');
    if (main === null || main.contains(document.activeElement)) return;
    main.querySelector<HTMLElement>('h1')?.focus();
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-border-default bg-canvas">
        <div className="flex min-h-[var(--size-shell-header)] flex-wrap items-center gap-x-app-4 px-app-4">
          <span className="text-app-body font-semibold text-fg-emphasis">Umapi Console</span>
          <nav aria-label="Console" className="order-last w-full md:order-none md:w-auto">
            <ul className="flex gap-app-4">
              {NAVIGATION.map(({ to, label }) => (
                <li key={to}>
                  <NavLink to={to} className={navClass}>
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="ml-auto flex min-w-0 items-center gap-app-2 py-app-1">
            {typeof email === 'string' ? (
              <span className="hidden truncate font-mono text-app-meta text-fg-identifier sm:inline">
                {email}
              </span>
            ) : null}
            <SignOutButton />
          </div>
        </div>
        {offline ? (
          <p
            role="alert"
            className="border-t border-border-danger px-app-4 py-app-1 text-app-meta text-fg-danger"
          >
            {OFFLINE_COPY}
          </p>
        ) : null}
        <ColdStartLine />
      </header>

      <div className="flex flex-1 flex-col">
        <ErrorBoundary key={pathname}>
          <Outlet />
        </ErrorBoundary>
      </div>

      <Inspector />
    </div>
  );
}
