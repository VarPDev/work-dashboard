/**
 * Theme choice. Pure helpers, shared by the toggle and by the script that runs
 * before the first paint.
 */

export type ThemeMode = 'system' | 'light' | 'dark';

export const THEME_STORAGE_KEY = 'jira-dashboard:theme';

const MODES: ThemeMode[] = ['system', 'light', 'dark'];

export function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === 'string' && (MODES as string[]).includes(value);
}

export function parseThemeMode(raw: string | null): ThemeMode {
  return isThemeMode(raw) ? raw : 'system';
}

/** What the toggle switches to next: system -> light -> dark -> system. */
export function nextThemeMode(mode: ThemeMode): ThemeMode {
  return MODES[(MODES.indexOf(mode) + 1) % MODES.length];
}

/** The theme actually applied, once the system preference is known. */
export function resolveTheme(mode: ThemeMode, systemPrefersDark: boolean): 'light' | 'dark' {
  if (mode === 'system') return systemPrefersDark ? 'dark' : 'light';
  return mode;
}

/**
 * Runs before the first paint, from the document head, so the page never flashes
 * the wrong theme. Kept as a string because it has to execute before React does;
 * it is inlined, never fetched.
 */
export const THEME_INIT_SCRIPT = `(function(){try{
var m=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
if(m!=='light'&&m!=='dark'&&m!=='system')m='system';
var dark=m==='dark'||(m==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
document.documentElement.classList.toggle('dark',dark);
}catch(e){}})();`;
