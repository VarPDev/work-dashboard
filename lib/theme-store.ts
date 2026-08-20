/**
 * The theme as an external store: the choice lives in localStorage, the fallback
 * in the OS setting. Both are outside React, which is exactly what
 * useSyncExternalStore is for — and it keeps the toggle free of the
 * setState-inside-an-effect pattern.
 */

import { parseThemeMode, resolveTheme, THEME_STORAGE_KEY, type ThemeMode } from './theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

/** Snapshots must be primitives, or every render looks like a change. */
export type ThemeSnapshot = `${ThemeMode}|${'dark' | 'light'}`;

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribeToTheme(listener: () => void): () => void {
  listeners.add(listener);

  const media = window.matchMedia(DARK_QUERY);
  // Another tab writing the choice, and the OS switching theme.
  window.addEventListener('storage', listener);
  media.addEventListener('change', listener);

  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
    media.removeEventListener('change', listener);
  };
}

export function getThemeSnapshot(): ThemeSnapshot {
  const mode = parseThemeMode(window.localStorage.getItem(THEME_STORAGE_KEY));
  const systemDark = window.matchMedia(DARK_QUERY).matches;
  return `${mode}|${resolveTheme(mode, systemDark)}`;
}

/** On the server nothing is known yet; the pre-paint script fixes it up. */
export function getServerThemeSnapshot(): ThemeSnapshot {
  return 'system|light';
}

export function parseThemeSnapshot(snapshot: ThemeSnapshot): {
  mode: ThemeMode;
  applied: 'light' | 'dark';
} {
  const [mode, applied] = snapshot.split('|');
  return { mode: parseThemeMode(mode), applied: applied === 'dark' ? 'dark' : 'light' };
}

export function storeThemeMode(mode: ThemeMode): void {
  window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  // localStorage fires no event in the tab that wrote it.
  emit();
}
