/**
 * The users feature: the directory in PR 12, the user's detail in PR 13, and
 * the read-only roles in PR 16.
 * `app/` composes it; no other feature imports it (ADR 0003).
 */
export { DetailScreen } from '@/features/users/DetailScreen';
export { DirectoryScreen } from '@/features/users/DirectoryScreen';
export { USER_PATH, USERS_PATH } from '@/features/users/paths';
export { ROLES_PATH, RolesScreen } from '@/features/users/RolesScreen';
