import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router';

import App from '@/app/App';
import { RequireSession, SIGN_IN_PATH, SessionBoundary, SignInScreen } from '@/features/auth';

/**
 * The route table.
 *
 * Every route that depends on who is signed in sits under `SessionBoundary`,
 * which renders the boot screen until the API has answered the refresh
 * (inventory section 3.1). Sign-in is inside it, so a signed-in user who opens
 * it is sent on rather than shown the form; everything else is also inside
 * `RequireSession`.
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

export function AppRoutes() {
  return (
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
          <Route path="/" element={<App />} />
        </Route>
      </Route>
    </Routes>
  );
}
