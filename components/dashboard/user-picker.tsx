'use client';

import { Check, ChevronsUpDown, UserRound } from 'lucide-react';
import { useState } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { SelectableUser } from '@/lib/dashboard-types';
import { initials } from '@/lib/format';
import { cn } from '@/lib/utils';

type UserPickerProps = {
  users: SelectableUser[];
  selected: SelectableUser | null;
  defaultAccountId: string | null;
  disabled?: boolean;
  onSelect: (accountId: string) => void;
};

export function UserPicker({
  users,
  selected,
  defaultAccountId,
  disabled,
  onSelect,
}: UserPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-[17rem] justify-between"
        >
          <span className="flex min-w-0 items-center gap-2">
            {selected ? (
              <>
                <Avatar className="size-5">
                  {selected.avatarUrl ? <AvatarImage src={selected.avatarUrl} alt="" /> : null}
                  <AvatarFallback className="text-[10px]">
                    {initials(selected.displayName)}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">{selected.displayName}</span>
              </>
            ) : (
              <>
                <UserRound className="size-4 opacity-60" />
                <span className="text-muted-foreground">Scegli un utente</span>
              </>
            )}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[17rem] p-0" align="start">
        <Command>
          <CommandInput placeholder="Cerca una persona…" />
          <CommandList>
            <CommandEmpty>Nessun utente trovato.</CommandEmpty>
            <CommandGroup>
              {users.map((user) => (
                <CommandItem
                  key={user.accountId}
                  // cmdk filters on this value, so the name has to be in it.
                  value={`${user.displayName} ${user.accountId}`}
                  onSelect={() => {
                    setOpen(false);
                    onSelect(user.accountId);
                  }}
                >
                  <Avatar className="size-5">
                    {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
                    <AvatarFallback className="text-[10px]">
                      {initials(user.displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">{user.displayName}</span>
                  {user.accountId === defaultAccountId ? (
                    <span className="ml-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                      io
                    </span>
                  ) : null}
                  <Check
                    className={cn(
                      'ml-auto size-4',
                      user.accountId === selected?.accountId ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
