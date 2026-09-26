import { formatRemaining, remainingSeconds } from '@/lib/api/expiry';

describe('expiry counted from arrival (section 4.5, row 40)', () => {
  it('counts the lifetime down from the moment the token arrived', () => {
    expect(remainingSeconds(900, 5_000, 5_000)).toBe(900);
    expect(remainingSeconds(900, 5_000, 5_001)).toBe(900);
    expect(remainingSeconds(900, 5_000, 6_000)).toBe(899);
    expect(remainingSeconds(900, 5_000, 905_000)).toBe(0);
  });

  it('never goes below zero', () => {
    expect(remainingSeconds(900, 0, 2_000_000)).toBe(0);
  });

  it.each([
    [900, '15:00'],
    [899, '14:59'],
    [61, '1:01'],
    [9, '0:09'],
  ])('shows %i seconds as %s', (seconds, shown) => {
    expect(formatRemaining(seconds)).toBe(shown);
  });
});
