import { endOfDayInZone, isDateOnly } from './timezone.util';

describe('isDateOnly', () => {
  it('returns true for a bare date string', () => {
    expect(isDateOnly('2026-07-20')).toBe(true);
  });

  it('returns false for a string with a time component', () => {
    expect(isDateOnly('2026-07-20T15:00:00Z')).toBe(false);
  });

  it('returns false for a non-zero-padded date string', () => {
    expect(isDateOnly('2026-7-20')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isDateOnly('')).toBe(false);
  });
});

describe('endOfDayInZone', () => {
  it('resolves end-of-day in America/New_York during EDT (UTC-4)', () => {
    expect(endOfDayInZone('2026-07-20', 'America/New_York')).toEqual(
      new Date('2026-07-21T03:59:59.999Z'),
    );
  });

  it('resolves end-of-day in America/New_York during EST (UTC-5)', () => {
    expect(endOfDayInZone('2026-01-15', 'America/New_York')).toEqual(
      new Date('2026-01-16T04:59:59.999Z'),
    );
  });

  it('resolves end-of-day in UTC as a zero-offset control case', () => {
    expect(endOfDayInZone('2026-07-20', 'UTC')).toEqual(
      new Date('2026-07-20T23:59:59.999Z'),
    );
  });

  it('resolves end-of-day in a positive-offset zone', () => {
    expect(endOfDayInZone('2026-07-20', 'Pacific/Auckland')).toEqual(
      new Date('2026-07-20T11:59:59.999Z'),
    );
  });
});
