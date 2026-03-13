import { isAbandoned } from '../pause-manager';

describe('isAbandoned', () => {
  it('returns false for null paused_at', () => {
    expect(isAbandoned(null)).toBe(false);
  });

  it('returns false for recently paused session (1 hour ago)', () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    expect(isAbandoned(oneHourAgo)).toBe(false);
  });

  it('returns false for session paused exactly 6 days ago', () => {
    const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();
    expect(isAbandoned(sixDaysAgo)).toBe(false);
  });

  it('returns true for session paused 8 days ago', () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    expect(isAbandoned(eightDaysAgo)).toBe(true);
  });

  it('returns true for session paused 30 days ago', () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    expect(isAbandoned(thirtyDaysAgo)).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(isAbandoned('')).toBe(false);
  });
});
