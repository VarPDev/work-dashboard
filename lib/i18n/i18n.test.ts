import { describe, expect, it } from 'vitest';

import { de } from './de';
import { en } from './en';
import {
  detectLocale,
  FALLBACK_LOCALE,
  intlLocale,
  isLocale,
  LOCALES,
  localeLabel,
  messages,
  parseLocale,
} from './index';
import { it as italian } from './it';

/** Every leaf of the message tree, as dotted paths. */
function paths(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    paths(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe('the dictionaries', () => {
  it('cover exactly the same keys', () => {
    // The Messages type already enforces this at compile time; this catches a
    // stray extra key, which the type would not.
    expect(paths(en).sort()).toEqual(paths(italian).sort());
    expect(paths(de).sort()).toEqual(paths(italian).sort());
  });

  it('leave nothing empty', () => {
    for (const locale of LOCALES) {
      const untranslated = paths(messages[locale]).filter((path) => {
        const value = path
          .split('.')
          .reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], messages[locale]);
        return typeof value === 'string' && value.trim() === '';
      });
      expect(untranslated).toEqual([]);
    }
  });

  it('keeps count-dependent strings as functions, so plurals can differ', () => {
    expect(typeof italian.totals.mentions).toBe('function');
    expect(typeof en.totals.mentions).toBe('function');
    expect(italian.totals.mentions(1)).not.toBe(italian.totals.mentions(2));
    expect(en.totals.mentions(1)).not.toBe(en.totals.mentions(2));
  });

  it('does not leave Italian text in the English dictionary', () => {
    const italianWords =
      /\b(menzion\w*|assegnat\w*|scadut\w*|nessun\w*|aggiornat\w*|commento|board non|tutte)\b/i;
    const leftovers = paths(en).filter((path) => {
      const value = path
        .split('.')
        .reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], en);
      return typeof value === 'string' && italianWords.test(value);
    });
    expect(leftovers).toEqual([]);
  });
});

describe('picking a locale', () => {
  it('reads a stored choice, and ignores nonsense', () => {
    expect(parseLocale('en')).toBe('en');
    expect(parseLocale('it')).toBe('it');
    expect(parseLocale('fr')).toBeNull();
    expect(parseLocale(null)).toBeNull();
    expect(parseLocale('EN')).toBeNull();
  });

  it('follows the browser, matching on the language part only', () => {
    expect(detectLocale(['en-GB', 'it-IT'])).toBe('en');
    expect(detectLocale(['it-IT'])).toBe('it');
    expect(detectLocale(['EN-US'])).toBe('en');
  });

  it('skips languages it does not have and takes the next one', () => {
    expect(detectLocale(['fr-FR', 'es-ES', 'en-US'])).toBe('en');
  });

  it('falls back when the browser offers nothing supported', () => {
    expect(detectLocale(['fr-FR'])).toBe(FALLBACK_LOCALE);
    expect(detectLocale([])).toBe(FALLBACK_LOCALE);
  });

  it('recognises German too', () => {
    expect(detectLocale(['de-AT', 'it-IT'])).toBe('de');
    expect(parseLocale('de')).toBe('de');
  });

  it('names every language in its own language', () => {
    expect(localeLabel('it')).toBe('Italiano');
    expect(localeLabel('en')).toBe('English');
    expect(localeLabel('de')).toBe('Deutsch');
  });

  it('maps to a tag Intl understands', () => {
    for (const locale of LOCALES) {
      expect(() => new Intl.DateTimeFormat(intlLocale(locale))).not.toThrow();
      expect(isLocale(locale)).toBe(true);
    }
  });
});
