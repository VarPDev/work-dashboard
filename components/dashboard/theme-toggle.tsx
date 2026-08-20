'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useSyncExternalStore } from 'react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  getServerThemeSnapshot,
  getThemeSnapshot,
  parseThemeSnapshot,
  storeThemeMode,
  subscribeToTheme,
} from '@/lib/theme-store';
import type { Messages } from '@/lib/i18n';
import { nextThemeMode, type ThemeMode } from '@/lib/theme';

export function ThemeToggle({ t }: { t: Messages }) {
  const labels: Record<ThemeMode, string> = {
    system: t.theme.system,
    light: t.theme.light,
    dark: t.theme.dark,
  };

  const snapshot = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );
  const { mode, applied } = parseThemeSnapshot(snapshot);

  // The class on <html> is an external system, which is what effects are for.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', applied === 'dark');
  }, [applied]);

  const Icon = mode === 'system' ? Monitor : mode === 'dark' ? Moon : Sun;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => storeThemeMode(nextThemeMode(mode))}
          aria-label={labels[mode]}
          data-theme-mode={mode}
        >
          <Icon className="size-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {labels[mode]}
        {mode === 'system'
          ? ` (${applied === 'dark' ? t.theme.nowDark : t.theme.nowLight})`
          : ''}
      </TooltipContent>
    </Tooltip>
  );
}
