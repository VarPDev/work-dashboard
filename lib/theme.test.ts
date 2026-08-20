import { describe, expect, it } from 'vitest';

import {
  isThemeMode,
  nextThemeMode,
  parseThemeMode,
  resolveTheme,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
} from './theme';

describe('reading the stored choice', () => {
  it('defaults to following the system', () => {
    expect(parseThemeMode(null)).toBe('system');
    expect(parseThemeMode('')).toBe('system');
    expect(parseThemeMode('nonsense')).toBe('system');
    expect(parseThemeMode('DARK')).toBe('system');
  });

  it('accepts the three real values', () => {
    expect(parseThemeMode('system')).toBe('system');
    expect(parseThemeMode('light')).toBe('light');
    expect(parseThemeMode('dark')).toBe('dark');
  });

  it('recognises valid modes', () => {
    expect(isThemeMode('dark')).toBe(true);
    expect(isThemeMode(null)).toBe(false);
    expect(isThemeMode(2)).toBe(false);
  });
});

describe('what the button switches to', () => {
  it('cycles system -> light -> dark -> system', () => {
    expect(nextThemeMode('system')).toBe('light');
    expect(nextThemeMode('light')).toBe('dark');
    expect(nextThemeMode('dark')).toBe('system');
  });

  it('always comes back to where it started', () => {
    expect(nextThemeMode(nextThemeMode(nextThemeMode('system')))).toBe('system');
  });
});

describe('resolving to an actual theme', () => {
  it('follows the system only when the mode is system', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('ignores the system once a choice is made', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('the pre-paint script', () => {
  it('reads the same key the toggle writes', () => {
    expect(THEME_INIT_SCRIPT).toContain(JSON.stringify(THEME_STORAGE_KEY));
  });

  it('falls back to the system preference', () => {
    expect(THEME_INIT_SCRIPT).toContain('prefers-color-scheme: dark');
  });

  it('cannot break the page if storage is unavailable', () => {
    expect(THEME_INIT_SCRIPT).toContain('catch');
  });

  it('is a single self-contained statement, safe to inline', () => {
    expect(THEME_INIT_SCRIPT.startsWith('(function()')).toBe(true);
    expect(THEME_INIT_SCRIPT).not.toContain('</script');
  });
});
