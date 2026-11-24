/**
 * The landing feature's public surface (ADR 0003, ADR 0018). `app/` loads it
 * lazily for `/` and decides its call to action.
 */
export { LandingPage, type LandingAction } from '@/features/landing/LandingPage';
