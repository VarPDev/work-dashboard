import { describe, expect, it } from 'vitest';

import { formatAge, formatClockTime, formatDueDate, formatRelative, initials } from './format';
import { en } from './i18n/en';
import { it as italian } from './i18n/it';

const NOW = new Date('2026-08-20T15:00:00.000Z');
const IT = 'it-IT';
const EN = 'en-GB';

function minutesAgo(minutes: number): string {
  return new Date(NOW.getTime() - minutes * 60_000).toISOString();
}

describe('data age', () => {
  it('uses the message for "just fetched", in both languages', () => {
    expect(formatAge(minutesAgo(0), IT, italian.header.ageNow, NOW)).toBe('adesso');
    expect(formatAge(minutesAgo(0), EN, en.header.ageNow, NOW)).toBe('just now');
  });

  it('counts minutes, then hours, in the active language', () => {
    expect(formatAge(minutesAgo(12), IT, italian.header.ageNow, NOW)).toBe('12 minuti fa');
    expect(formatAge(minutesAgo(12), EN, en.header.ageNow, NOW)).toBe('12 minutes ago');
    expect(formatAge(minutesAgo(150), IT, italian.header.ageNow, NOW)).toBe('2 ore fa');
    expect(formatAge(minutesAgo(150), EN, en.header.ageNow, NOW)).toBe('2 hours ago');
  });

  it('does not go negative on a clock skew', () => {
    const future = new Date(NOW.getTime() + 10_000).toISOString();
    expect(formatAge(future, IT, italian.header.ageNow, NOW)).toBe('adesso');
  });
});

describe('mention age', () => {
  it('reads naturally in Italian', () => {
    expect(formatRelative(minutesAgo(60), IT, NOW)).toBe('oggi');
    expect(formatRelative(minutesAgo(60 * 25), IT, NOW)).toBe('ieri');
    expect(formatRelative(minutesAgo(60 * 24 * 3), IT, NOW)).toBe('3 giorni fa');
    expect(formatRelative(minutesAgo(60 * 24 * 90), IT, NOW)).toBe('3 mesi fa');
  });

  it('reads naturally in English', () => {
    expect(formatRelative(minutesAgo(60), EN, NOW)).toBe('today');
    expect(formatRelative(minutesAgo(60 * 25), EN, NOW)).toBe('yesterday');
    expect(formatRelative(minutesAgo(60 * 24 * 3), EN, NOW)).toBe('3 days ago');
    expect(formatRelative(minutesAgo(60 * 24 * 90), EN, NOW)).toBe('3 months ago');
  });
});

describe('dates and times', () => {
  it('formats a due date per locale, without shifting the day', () => {
    expect(formatDueDate('2026-08-05', IT)).toMatch(/^05 ago/);
    expect(formatDueDate('2026-08-05', EN)).toMatch(/^05 Aug/);
  });

  it('formats a clock time', () => {
    // Both locales use 24h here, so only the separator could differ.
    expect(formatClockTime('2026-08-20T15:03:00.000Z', IT)).toMatch(/\d{2}[:.]\d{2}/);
    expect(formatClockTime('2026-08-20T15:03:00.000Z', EN)).toMatch(/\d{2}[:.]\d{2}/);
  });
});

describe('counts in both languages', () => {
  it('agrees with the count in Italian', () => {
    expect(italian.totals.mentions(0)).toBe('0 menzioni');
    expect(italian.totals.mentions(1)).toBe('1 menzione');
    expect(italian.totals.assigned(1)).toBe('1 assegnata');
    expect(italian.list.itemCount(1)).toBe('1 elemento');
  });

  it('agrees with the count in English', () => {
    expect(en.totals.mentions(0)).toBe('0 mentions');
    expect(en.totals.mentions(1)).toBe('1 mention');
    expect(en.list.itemCount(1)).toBe('1 item');
    expect(en.list.itemCount(3)).toBe('3 items');
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
