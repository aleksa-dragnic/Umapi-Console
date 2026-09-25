/**
 * The auth feature's public surface. `app/` composes these; nothing outside
 * this folder imports its other files (ADR 0003).
 */
export { RequireSession } from '@/features/auth/RequireSession';
export { SessionBoundary } from '@/features/auth/SessionBoundary';
export { SignInScreen } from '@/features/auth/SignInScreen';
export { useSession } from '@/features/auth/session';
export { SIGN_IN_PATH } from '@/features/auth/next';
