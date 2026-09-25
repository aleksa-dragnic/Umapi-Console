import { setupServer } from 'msw/node';
import { handlers } from '@/lib/testing/handlers';

/** The mock for Vitest. `src/setupTests.ts` starts it for every test file. */
export const server = setupServer(...handlers);
