import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router';

import App from '@/app/App';

/**
 * The route table.
 *
 * /_design is the specimen route and exists in development only. The guard is
 * import.meta.env.DEV, which the build replaces with a literal, so the whole
 * branch - including the dynamic import inside it - is removed from the
 * production bundle rather than merely made unreachable. The apply script
 * proves that by grepping dist/ after a build; hiding the route would leave
 * the module in the bundle and the claim would be false.
 */
const Specimen = import.meta.env.DEV ? lazy(() => import('@/app/design/Specimen')) : null;

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<App />} />
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
    </Routes>
  );
}
