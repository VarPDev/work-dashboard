'use client';

import { Search, X } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { Input } from '@/components/ui/input';
import type { Messages } from '@/lib/i18n';

/**
 * Fuzzy search over the list. "/" focuses it from anywhere on the page, Escape
 * clears it — both are what a keyboard-first reader expects.
 */
export function SearchBox({
  value,
  t,
  onChange,
}: {
  value: string;
  t: Messages;
  onChange: (value: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;

      // Not while typing somewhere else: a slash belongs in the text then.
      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;
      if (typing) return;

      event.preventDefault();
      input.current?.focus();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="relative w-[15rem]">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={input}
        // Not type="search": browsers add their own clear button, and there is
        // one below already.
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onChange('');
        }}
        placeholder={t.search.placeholder}
        aria-label={t.search.label}
        data-testid="search-box"
        className="h-8 pl-8 pr-8"
      />
      {value ? (
        <button
          type="button"
          aria-label={t.search.clear}
          onClick={() => {
            onChange('');
            input.current?.focus();
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
