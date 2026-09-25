import { HttpResponse, http } from 'msw';
import { origin } from '@/lib/testing/http';
import { coldStart } from '@/lib/testing/limits';
import { isDatabaseDown } from '@/lib/testing/scenario';

// The health endpoints are not in the OpenAPI document, so they are matched by
// path rather than through the generated types. Bodies not measured.
export const healthHandlers = [
  http.get(origin('/health/live'), async () => {
    await coldStart(); // Rows 35 and 36.
    return HttpResponse.text('Healthy');
  }),
  http.get(origin('/health/ready'), async () => {
    await coldStart(); // Row 35.
    // Row 37: readiness fails with the database; liveness does not.
    return isDatabaseDown()
      ? HttpResponse.text('Unhealthy', { status: 503 })
      : HttpResponse.text('Healthy');
  }),
];
