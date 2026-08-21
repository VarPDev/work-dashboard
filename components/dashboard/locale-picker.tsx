'use client';

import { Check, Languages } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { LOCALES, localeLabel, type Locale, type Messages } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/**
 * Language picker. Each language is listed under its own name — someone looking
 * for German reads "Deutsch", not "Tedesco".
 */
export function LocalePicker({
  locale,
  t,
  onSelect,
}: {
  locale: Locale;
  t: Messages;
  onSelect: (locale: Locale) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              aria-label={t.locale.picker}
              aria-expanded={open}
              data-locale={locale}
            >
              <Languages className="size-3.5" />
              <span className="font-mono text-[10px] uppercase">{locale}</span>
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{t.locale.picker}</TooltipContent>
      </Tooltip>

      <PopoverContent className="w-44 p-1" align="end">
        {LOCALES.map((candidate) => (
          <button
            key={candidate}
            type="button"
            lang={candidate}
            data-locale-option={candidate}
            aria-current={candidate === locale}
            onClick={() => {
              setOpen(false);
              onSelect(candidate);
            }}
            className={cn(
              'flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted',
              candidate === locale && 'font-medium',
            )}
          >
            <span className="font-mono text-[10px] uppercase text-muted-foreground">
              {candidate}
            </span>
            <span className="truncate">{localeLabel(candidate)}</span>
            <Check
              className={cn('ml-auto size-3.5', candidate === locale ? 'opacity-100' : 'opacity-0')}
            />
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
