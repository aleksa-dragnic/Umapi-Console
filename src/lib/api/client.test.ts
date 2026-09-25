import { API_BASE_URL, createApiClient } from '@/lib/api/client';

const BASE = 'https://api.example.test';

function captureRequests(): Request[] {
  const seen: Request[] = [];
  vi.stubGlobal('fetch', (request: Request) => {
    seen.push(request);
    return Promise.resolve(Response.json([], { status: 200 }));
  });
  return seen;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createApiClient', () => {
  it('targets the configured base URL when none is passed', async () => {
    const seen = captureRequests();
    await createApiClient().GET('/api/v1/roles');
    expect(seen[0]?.url).toBe(`${API_BASE_URL.replace(/\/$/, '')}/api/v1/roles`);
  });

  it('sends every request with credentials included, so the refresh cookie travels', async () => {
    const seen = captureRequests();
    await createApiClient(BASE).GET('/api/v1/users');
    expect(seen).toHaveLength(1);
    expect(seen[0]?.credentials).toBe('include');
  });

  it('joins the base URL and the generated path without doubling the version prefix', async () => {
    const seen = captureRequests();
    await createApiClient(`${BASE}/`).GET('/api/v1/users/{id}', {
      params: { path: { id: '345d5955-fa12-48ae-b007-98dabc87f86e' } },
    });
    expect(seen[0]?.url).toBe(`${BASE}/api/v1/users/345d5955-fa12-48ae-b007-98dabc87f86e`);
  });

  it('sends query parameters under the names the document gives them', async () => {
    const seen = captureRequests();
    await createApiClient(BASE).GET('/api/v1/users', {
      params: { query: { PageSize: 25, SearchTerm: 'Petrović', OrderBy: 'lastName desc' } },
    });
    const url = new URL(seen[0]?.url ?? '');
    expect(url.searchParams.get('PageSize')).toBe('25');
    expect(url.searchParams.get('SearchTerm')).toBe('Petrović');
    expect(url.searchParams.get('OrderBy')).toBe('lastName desc');
  });

  it('looks fetch up when a request is made, not when the client is created', async () => {
    const client = createApiClient(BASE);
    const seen = captureRequests();
    await client.GET('/api/v1/roles');
    expect(seen).toHaveLength(1);
  });
});
