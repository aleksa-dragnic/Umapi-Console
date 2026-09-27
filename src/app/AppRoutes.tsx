import { Suspense, lazy } from 'react';
import { Outlet, Route, Routes } from 'react-router';

import App from '@/app/App';
import { QueryProvider } from '@/app/query-client';
import {
  RequirePermission,
  RequireSession,
  SESSION_PATH,
  SIGN_IN_PATH,
  SessionBoundary,
  SessionScreen,
  SignInScreen,
} from '@/features/auth';
import { Inspector } from '@/features/inspector';
import { DetailScreen, DirectoryScreen, USER_PATH, USERS_PATH } from '@/features/users';

/**
 * The route table.
 *
 * Every route that depends on who is signed in sits under `SessionBoundary`,
 * which renders the boot screen until the API has answered the refresh
 * (inventory section 3.1). Sign-in is inside it, so a signed-in user who opens
 * it is sent on rather than shown the form; everything else is also inside
 * `RequireSession`. The session screen needs no permission beyond a session
 * (decision 5); a route that does wraps itself in `RequirePermission`. Every
 * screen behind the login has the inspector docked beneath it (inventory
 * section 3.8); sign-in and boot do not.
 *
 * /_design is the specimen route and exists in development only. It sits
 * outside the boundary: reviewing the primitives needs no session and makes no
 * request. The guard is import.meta.env.DEV, which the build replaces with a
 * literal, so the whole branch - including the dynamic import inside it - is
 * removed from the production bundle rather than merely made unreachable. CI
 * proves that by searching dist/ after the production build; hiding the route
 * would leave the module in the bundle and the claim would be false.
 */
const Specimen = import.meta.env.DEV ? lazy(() => import('@/app/design/Specimen')) : null;

/** A screen behind the login, with the inspector docked beneath it. */
function Inspected() {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex flex-1 flex-col">
        <Outlet />
      </div>
      <Inspector />
    </div>
  );
}

export function AppRoutes() {
  return (
    <QueryProvider>
      <Routes>
        {Specimen === null ? null : (
          <Route
            path="/_design"
            element={
              <Suspense fallback={null}>
                <Specimen />
              </Suspense>
            }
          />
        )}
        <Route element={<SessionBoundary />}>
          <Route path={SIGN_IN_PATH} element={<SignInScreen />} />
          <Route element={<RequireSession />}>
            <Route element={<Inspected />}>
              <Route path="/" element={<App />} />
              <Route path={SESSION_PATH} element={<SessionScreen />} />
              <Route element={<RequirePermission permission="users.read" />}>
                <Route path={USERS_PATH} element={<DirectoryScreen />} />
                <Route path={USER_PATH} element={<DetailScreen />} />
              </Route>
            </Route>
          </Route>
        </Route>
      </Routes>
    </QueryProvider>
  );
}
