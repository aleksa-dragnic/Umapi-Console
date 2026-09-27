/**
 * The users feature: the directory in PR 12, and the user's detail in PR 13.
 * `app/` composes it; no other feature imports it (ADR 0003).
 */
export { DetailScreen } from '@/features/users/DetailScreen';
export { DirectoryScreen } from '@/features/users/DirectoryScreen';
export { USER_PATH, USERS_PATH } from '@/features/users/paths';
