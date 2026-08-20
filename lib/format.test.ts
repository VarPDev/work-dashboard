import { describe, expect, it } from 'vitest';

import { formatAge, formatRelative, initials, plural } from './format';

const NOW = new Date('2026-08-20T15:00:00.000Z');

function minutesAgo(minutes: number): string {
  return new Date(NOW.getTime() - minutes * 60_000).toISOString();
}

describe('data age', () => {
  it('says "adesso" for something just fetched', () => {
    expect(formatAge(minutesAgo(0), NOW)).toBe('adesso');
    expect(formatAge(minutesAgo(0.5), NOW)).toBe('adesso');
  });

  it('counts minutes up to an hour', () => {
    expect(formatAge(minutesAgo(1), NOW)).toBe('1 min fa');
    expect(formatAge(minutesAgo(29), NOW)).toBe('29 min fa');
    expect(formatAge(minutesAgo(59), NOW)).toBe('59 min fa');
  });

  it('switches to hours, singular and plural', () => {
    expect(formatAge(minutesAgo(60), NOW)).toBe('1 ora fa');
    expect(formatAge(minutesAgo(150), NOW)).toBe('2 ore fa');
  });

  it('does not go negative on a clock skew', () => {
    expect(formatAge(new Date(NOW.getTime() + 10_000).toISOString(), NOW)).toBe('adesso');
  });
});

describe('mention age', () => {
  it('reads oggi, ieri, then days and months', () => {
    expect(formatRelative(minutesAgo(60), NOW)).toBe('oggi');
    expect(formatRelative(minutesAgo(60 * 25), NOW)).toBe('ieri');
    expect(formatRelative(minutesAgo(60 * 24 * 3), NOW)).toBe('3 giorni fa');
    expect(formatRelative(minutesAgo(60 * 24 * 35), NOW)).toBe('1 mese fa');
    expect(formatRelative(minutesAgo(60 * 24 * 90), NOW)).toBe('3 mesi fa');
  });
});

describe('plural', () => {
  it('agrees with the count', () => {
    expect(plural(0, 'menzione', 'menzioni')).toBe('0 menzioni');
    expect(plural(1, 'menzione', 'menzioni')).toBe('1 menzione');
    expect(plural(2, 'menzione', 'menzioni')).toBe('2 menzioni');
  });
});

describe('avatar initials', () => {
  it('takes at most two words', () => {
    expect(initials('Mario Rossi')).toBe('MR');
    expect(initials('Anna')).toBe('A');
  });

  it('survives odd names', () => {
    expect(initials('nome.cognome')).toBe('N');
    expect(initials('')).toBe('');
  });
});
