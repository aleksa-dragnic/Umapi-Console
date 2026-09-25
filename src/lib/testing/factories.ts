import { pick, seededRandom, uuid } from '@/lib/testing/random';

/**
 * Realistic data for the mock: about 130 users with latin-ext names across all
 * four statuses (build plan PR 8), plus the two accounts production has (row 20).
 * Addresses use example.org, a reserved domain.
 */

export const PERMISSIONS = [
  'users.read',
  'users.write',
  'users.lock',
  'roles.read',
  'roles.manage',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

// Row 18: the four values the API accepts.
export const USER_STATUSES = ['Pending', 'Active', 'Locked', 'Deactivated'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export interface MockRole {
  id: string;
  name: string;
  permissions: Permission[];
}

export interface MockRoleAssignment {
  roleId: string;
  assignedAtUtc: string;
}

export interface MockUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: UserStatus;
  password: string;
  roles: MockRoleAssignment[];
  createdAtUtc: string;
  updatedAtUtc: string;
}

// Row 20: the demo user's one role is Member. Row 48: what each permission
// allows. Administrator holds all five. Support is the mock's own middle role,
// so a gate that depends on one permission has an account that lacks another.
export const ROLES: readonly MockRole[] = [
  {
    id: '0d6f1c8e-2b8a-4c55-9a37-5b1f3c9e7a10',
    name: 'Administrator',
    permissions: [...PERMISSIONS],
  },
  {
    id: '6a3e9b41-7c2d-4f18-8e55-2d9c4b7a1f02',
    name: 'Support',
    permissions: ['users.read', 'users.lock', 'roles.read'],
  },
  {
    id: '28798d55-bd91-4d68-bbc2-c7cf4cb1dc56',
    name: 'Member',
    permissions: ['users.read', 'roles.read'],
  },
];

function roleId(name: string): string {
  const role = ROLES.find((candidate) => candidate.name === name);
  if (!role) {
    throw new Error(`Unknown role ${name}`);
  }
  return role.id;
}

/**
 * The accounts a test or a developer signs in with. The demo password is the one
 * the API's README publishes. The administrator password is the mock's own: the
 * deployed administrator's is never written down.
 */
export const MOCK_ACCOUNTS = {
  admin: {
    id: 'b1c7e0f2-5a4d-4e3b-9c8a-7f6e5d4c3b2a',
    email: 'admin@umapi.local',
    password: 'mock-admin-password',
  },
  demo: {
    id: '345d5955-fa12-48ae-b007-98dabc87f86e',
    email: 'demo@umapi.local',
    password: 'Demo-Passw0rd-2026!',
  },
} as const;

/** The password every synthetic user signs in with. */
export const SYNTHETIC_PASSWORD = 'mock-user-password';

const FIRST_NAMES = [
  'Marko',
  'Jelena',
  'Dušan',
  'Đorđe',
  'Željko',
  'Ivana',
  'Nikola',
  'Milica',
  'Stefan',
  'Tamara',
  'Aleksandar',
  'Katarina',
  'Luka',
  'Ana',
  'Miloš',
  'Snežana',
  'Ljiljana',
  'Njegoš',
  'Petar',
  'Zoran',
  'Branka',
  'Goran',
  'Vesna',
  'Bojan',
  'Jovana',
  'Uroš',
  'Đurđa',
  'Radmila',
  'Čedomir',
  'Žarko',
  'Šćepan',
  'Mirjana',
  'Agnieszka',
  'Łukasz',
  'Małgorzata',
  'Paweł',
  'Zofia',
  'Jiří',
  'Tomáš',
  'Kateřina',
  'Zoltán',
  'Réka',
  'Ádám',
  'Erzsébet',
  'Ștefan',
  'Ioana',
  'Gašper',
  'Špela',
  'Matija',
  'Nataša',
] as const;

const LAST_NAMES = [
  'Petrović',
  'Jovanović',
  'Nikolić',
  'Marković',
  'Đorđević',
  'Stojanović',
  'Ilić',
  'Stanković',
  'Pavlović',
  'Popović',
  'Živković',
  'Kovačević',
  'Šarić',
  'Čolić',
  'Vuković',
  'Babić',
  'Knežević',
  'Lukić',
  'Tošić',
  'Ćirić',
  'Radić',
  'Novak',
  'Horvat',
  'Kovač',
  'Žagar',
  'Nowak',
  'Wiśniewski',
  'Wójcik',
  'Dvořák',
  'Černý',
  'Nagy',
  'Kovács',
  'Szabó',
  'Tóth',
  'Horváth',
  'Popescu',
  'Ionescu',
  'Krajnc',
] as const;

const ASCII: Record<string, string> = {
  đ: 'dj',
  ł: 'l',
  ș: 's',
  ț: 't',
  ß: 'ss',
};

function asciiLocalPart(name: string): string {
  return name
    .toLowerCase()
    .replace(/[đłșțß]/g, (character) => ASCII[character] ?? character)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Roughly how a real directory spreads: most people active, a few waiting,
// locked or gone.
function statusFor(roll: number): UserStatus {
  if (roll < 0.7) return 'Active';
  if (roll < 0.8) return 'Pending';
  if (roll < 0.92) return 'Locked';
  return 'Deactivated';
}

const EPOCH = Date.parse('2025-03-01T08:00:00Z');
const SPAN = Date.parse('2026-09-01T08:00:00Z') - EPOCH;

function isoAt(ms: number): string {
  return new Date(Math.round(ms)).toISOString();
}

export const DEFAULT_SEED = 20260925;
export const SYNTHETIC_USER_COUNT = 128;

export function buildUsers(seed: number = DEFAULT_SEED): MockUser[] {
  const random = seededRandom(seed);
  const created = isoAt(EPOCH);
  const users: MockUser[] = [
    {
      id: MOCK_ACCOUNTS.admin.id,
      email: MOCK_ACCOUNTS.admin.email,
      firstName: 'System',
      lastName: 'Administrator',
      status: 'Active',
      password: MOCK_ACCOUNTS.admin.password,
      roles: [{ roleId: roleId('Administrator'), assignedAtUtc: created }],
      createdAtUtc: created,
      updatedAtUtc: created,
    },
    {
      id: MOCK_ACCOUNTS.demo.id,
      email: MOCK_ACCOUNTS.demo.email,
      firstName: 'Demo',
      lastName: 'Reader',
      status: 'Active',
      password: MOCK_ACCOUNTS.demo.password,
      roles: [{ roleId: roleId('Member'), assignedAtUtc: created }],
      createdAtUtc: created,
      updatedAtUtc: created,
    },
  ];

  const taken = new Set(users.map((user) => user.email));
  // Marko Petrović first: the name the documents use as their example.
  const fixed: Array<[string, string]> = [['Marko', 'Petrović']];

  for (let index = 0; users.length < SYNTHETIC_USER_COUNT + 2; index += 1) {
    const [firstName, lastName] = fixed[index] ?? [
      pick(random, FIRST_NAMES),
      pick(random, LAST_NAMES),
    ];
    let email = `${asciiLocalPart(firstName)}.${asciiLocalPart(lastName)}@example.org`;
    for (let suffix = 2; taken.has(email); suffix += 1) {
      email = `${asciiLocalPart(firstName)}.${asciiLocalPart(lastName)}${suffix}@example.org`;
    }
    taken.add(email);

    const createdMs = EPOCH + random() * SPAN;
    const updatedMs = createdMs + random() * (EPOCH + SPAN - createdMs);
    const roleRoll = random();
    const roleNames =
      roleRoll < 0.05 ? ['Administrator'] : roleRoll < 0.2 ? ['Support', 'Member'] : ['Member'];

    users.push({
      id: uuid(random),
      email,
      firstName,
      lastName,
      status: statusFor(random()),
      password: SYNTHETIC_PASSWORD,
      roles: roleNames.map((name) => ({ roleId: roleId(name), assignedAtUtc: isoAt(createdMs) })),
      createdAtUtc: isoAt(createdMs),
      updatedAtUtc: isoAt(updatedMs),
    });
  }
  return users;
}
