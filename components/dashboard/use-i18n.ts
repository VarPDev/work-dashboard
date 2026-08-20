'use client';

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';

import { intlLocale, messages, type Locale, type Messages } from '@/lib/i18n';
import {
  getLocaleSnapshot,
  getServerLocaleSnapshot,
  storeLocale,
  subscribeToLocale,
} from '@/lib/i18n/store';

export type Translation = {
  locale: Locale;
  /** BCP 47 tag for Intl date and number formatting. */
  tag: string;
  t: Messages;
  setLocale: (locale: Locale) => void;
};

export function useI18n(): Translation {
  const locale = useSyncExternalStore(
    subscribeToLocale,
    getLocaleSnapshot,
    getServerLocaleSnapshot,
  );

  // Assistive tech and the browser's own translation prompt both read this.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => storeLocale(next), []);

  return useMemo(
    () => ({ locale, tag: intlLocale(locale), t: messages[locale], setLocale }),
    [locale, setLocale],
  );
}
