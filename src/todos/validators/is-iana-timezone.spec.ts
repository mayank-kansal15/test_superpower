import { isValidIanaTimeZone } from './is-iana-timezone';

describe('isValidIanaTimeZone', () => {
  it('returns true for a valid IANA time zone', () => {
    expect(isValidIanaTimeZone('America/New_York')).toBe(true);
  });

  it('returns true for UTC', () => {
    expect(isValidIanaTimeZone('UTC')).toBe(true);
  });

  it('returns false for an unrecognized zone name', () => {
    expect(isValidIanaTimeZone('Not/AZone')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isValidIanaTimeZone('')).toBe(false);
  });
});
