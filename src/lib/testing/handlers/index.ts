import { authHandlers } from '@/lib/testing/handlers/auth';
import { healthHandlers } from '@/lib/testing/handlers/health';
import { roleHandlers } from '@/lib/testing/handlers/roles';
import { userHandlers } from '@/lib/testing/handlers/users';

export const handlers = [...authHandlers, ...userHandlers, ...roleHandlers, ...healthHandlers];
