/**
 * The mock's settable conditions. Tests and the dev server change them through
 * these functions; `resetScenario` restores the defaults after every test.
 */

export type RefreshRaceOutcome = 'conflict' | 'reuse';

interface Scenario {
  clockOffsetMs: number;
  coldStartMs: number;
  refreshRace: RefreshRaceOutcome;
  databaseDown: boolean;
}

// Row 11: live, the race ended in the 409 three times out of three.
const DEFAULTS: Scenario = {
  clockOffsetMs: 0,
  coldStartMs: 0,
  refreshRace: 'conflict',
  databaseDown: false,
};

let scenario: Scenario = { ...DEFAULTS };

export function resetScenario(): void {
  scenario = { ...DEFAULTS };
}

/** The mock server's clock. Moving it forward expires tokens without waiting. */
export function now(): number {
  return Date.now() + scenario.clockOffsetMs;
}

export function advanceClock(ms: number): void {
  scenario.clockOffsetMs += ms;
}

/**
 * Row 35: an idle instance answers its first request after about half a minute.
 * The next request waits this long, once; the ones after it are warm.
 */
export function simulateColdStart(ms: number): void {
  scenario.coldStartMs = ms;
}

export function takeColdStartDelay(): number {
  const delay = scenario.coldStartMs;
  scenario.coldStartMs = 0;
  return delay;
}

/** Rows 11 and 46: which way two concurrent refreshes with one token end. */
export function setRefreshRace(outcome: RefreshRaceOutcome): void {
  scenario.refreshRace = outcome;
}

export function refreshRace(): RefreshRaceOutcome {
  return scenario.refreshRace;
}

/** Row 37: readiness fails while the database is down; liveness does not. */
export function setDatabaseDown(down: boolean): void {
  scenario.databaseDown = down;
}

export function isDatabaseDown(): boolean {
  return scenario.databaseDown;
}
