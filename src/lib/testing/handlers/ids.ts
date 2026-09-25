import { seededRandom, uuid } from '@/lib/testing/random';

// Ids for records the mock creates while running, from their own seed so they
// never collide with the factories' and are the same on every run.
let next = seededRandom(7);

export const random = {
  uuid: () => uuid(next),
  reset: () => {
    next = seededRandom(7);
  },
};
