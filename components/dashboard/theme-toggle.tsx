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
import { nextThemeMode, type ThemeMode } from '@/lib/theme';

const LABELS: Record<ThemeMode, string> = {
  system: 'Tema: come il sistema',
  light: 'Tema: chiaro',
  dark: 'Tema: scuro',
};

export function ThemeToggle() {
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
          aria-label={LABELS[mode]}
          data-theme-mode={mode}
        >
          <Icon className="size-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {LABELS[mode]}
        {mode === 'system' ? ` (ora ${applied === 'dark' ? 'scuro' : 'chiaro'})` : ''}
      </TooltipContent>
    </Tooltip>
  );
}
