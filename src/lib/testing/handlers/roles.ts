import { HttpResponse, http } from 'msw';
import type { Schema } from '@/lib/api/client';
import { db } from '@/lib/testing/db';
import { guard } from '@/lib/testing/handlers/guard';
import {
  CACHE_HEADERS,
  VERSION_HEADERS,
  endpoint,
  matchesIfNoneMatch,
  weakETag,
} from '@/lib/testing/http';

export const roleHandlers = [
  http.get(endpoint('/api/v1/roles'), async ({ request }) => {
    const access = await guard(request, 'roles.read', 'read'); // Row 48.
    if (!access.ok) return access.response;
    const body: Schema<'RoleResponse'>[] = [...db().roles.values()].map((role) => ({
      id: role.id,
      name: role.name,
      permissions: [...role.permissions],
    }));
    const json = JSON.stringify(body);
    const etag = await weakETag(json);
    const headers = { ...CACHE_HEADERS, ...VERSION_HEADERS, ETag: etag };
    if (matchesIfNoneMatch(request, etag)) {
      return new HttpResponse(null, { status: 304, headers });
    }
    return new HttpResponse(json, {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
    });
  }),
];
