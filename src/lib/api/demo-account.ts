/**
 * The API's published demo account (observed row 20). It holds `users.read` and
 * `roles.read` only (row 4), so it can browse and cannot write (row 27). Its
 * password is published with the API on purpose, and the sign-in screen prints
 * both lines so a visitor can get in without asking anyone.
 */
export const DEMO_ACCOUNT = {
  email: 'demo@umapi.local',
  password: 'Demo-Passw0rd-2026!',
} as const;
