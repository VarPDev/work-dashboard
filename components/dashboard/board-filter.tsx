'use client';

import { FolderOpen, LayoutList, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { BoardFacet } from '@/lib/dashboard-types';
import { cn } from '@/lib/utils';

type BoardFilterProps = {
  boards: BoardFacet[];
  /** Empty means no board filter at all, which shows everything. */
  selected: Set<string>;
  onToggle: (boardId: string) => void;
  onClear: () => void;
};

/**
 * Multi-select chips, one per board present in the list. Additive: picking two
 * boards shows both, picking none shows everything.
 */
export function BoardFilter({ boards, selected, onToggle, onClear }: BoardFilterProps) {
  if (boards.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[11px] uppercase tracking-wide text-muted-foreground">board</span>

      {boards.map((board) => {
        const active = selected.has(board.id);
        return (
          <button
            key={board.id}
            type="button"
            aria-pressed={active}
            // Read by the browser tests, which cannot rely on the label text.
            data-testid="board-chip"
            data-board-id={board.id}
            data-count={board.count}
            onClick={() => onToggle(board.id)}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition-colors',
              active
                ? 'border-primary/50 bg-primary/15 text-foreground'
                : 'border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground',
            )}
          >
            {board.kind === 'board' ? (
              <LayoutList className="size-3 shrink-0" />
            ) : (
              <FolderOpen className="size-3 shrink-0 text-amber-600 dark:text-amber-400/80" />
            )}
            <span className="max-w-[16rem] truncate">{board.label}</span>
            <span className="font-mono text-[10px] opacity-70">{board.count}</span>
            {board.overdueCount > 0 ? (
              <span className="rounded-full bg-red-500/20 px-1 font-mono text-[10px] text-red-700 dark:text-red-300">
                {board.overdueCount}
              </span>
            ) : null}
          </button>
        );
      })}

      {selected.size > 0 ? (
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="size-3" />
          Tutte le board
        </Button>
      ) : null}
    </div>
  );
}
