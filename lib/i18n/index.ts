/**
 * Locale selection. The browser's language decides, until the reader says
 * otherwise; the choice then lives in localStorage like the theme.
 */

import { de } from './de';
import { en } from './en';
import { it } from './it';
import type { Messages } from './types';

export type { Messages } from './types';

export const LOCALES = ['it', 'en', 'de'] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_STORAGE_KEY = 'jira-dashboard:locale';

/** Italian is the fallback: it is the language the dashboard was written in. */
export const FALLBACK_LOCALE: Locale = 'it';

export const messages: Record<Locale, Messages> = { it, en, de };

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export function parseLocale(raw: string | null): Locale | null {
  return isLocale(raw) ? raw : null;
}

/**
 * Pick a locale from what the browser reports, e.g. ["it-IT", "en-US"]. Only the
 * language part matters: "en-GB" and "en-US" get the same messages.
 */
export function detectLocale(preferred: readonly string[]): Locale {
  for (const tag of preferred) {
    const language = tag.split('-')[0]?.toLowerCase();
    if (isLocale(language)) return language;
  }
  return FALLBACK_LOCALE;
}

/** BCP 47 tag for Intl formatting. */
const INTL_TAGS: Record<Locale, string> = {
  it: 'it-IT',
  en: 'en-GB',
  de: 'de-DE',
};

export function intlLocale(locale: Locale): string {
  return INTL_TAGS[locale];
}

/** What the picker lists: the language's own name, in that language. */
export function localeLabel(locale: Locale): string {
  return messages[locale].locale.label;
}
