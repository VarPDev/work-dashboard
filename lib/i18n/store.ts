/**
 * The locale as an external store, the same shape as the theme one: the stored
 * choice and `navigator.languages` both live outside React.
 */

import {
  detectLocale,
  FALLBACK_LOCALE,
  LOCALE_STORAGE_KEY,
  parseLocale,
  type Locale,
} from './index';

const listeners = new Set<() => void>();

export function subscribeToLocale(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('storage', listener);

  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

export function getLocaleSnapshot(): Locale {
  const stored = parseLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
  if (stored) return stored;

  // No choice made: follow the browser.
  return detectLocale(navigator.languages ?? [navigator.language]);
}

/**
 * The server cannot know the browser's language, so it renders the fallback and
 * the client corrects it on mount. The page is a client-side dashboard anyway —
 * the first paint is a skeleton with almost no text in it.
 */
export function getServerLocaleSnapshot(): Locale {
  return FALLBACK_LOCALE;
}

export function storeLocale(locale: Locale): void {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  // localStorage fires no event in the tab that wrote it.
  for (const listener of listeners) listener();
}
