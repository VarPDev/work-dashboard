'use client';

import {
  AtSign,
  CalendarClock,
  EyeOff,
  ExternalLink,
  MessageSquareReply,
  Undo2,
} from 'lucide-react';

import { CommentDialog } from '@/components/dashboard/comment-dialog';
import { useClamped } from '@/components/dashboard/use-clamped';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { DashboardItem } from '@/lib/dashboard-types';
import { formatDueDate, formatRelative, initials } from '@/lib/format';
import type { Messages } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** Priority tint. Ranking lives on the server; this is only colour. */
const PRIORITY_STYLES: Record<string, string> = {
  Highest: 'border-red-500/40 bg-red-500/15 text-red-700 dark:text-red-300',
  High: 'border-orange-500/40 bg-orange-500/15 text-orange-700 dark:text-orange-300',
  Medium: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  'Not Clear': 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  Low: 'border-border bg-muted/40 text-muted-foreground',
  'Very Low': 'border-border bg-muted/30 text-muted-foreground',
};

const STATUS_STYLES: Record<string, string> = {
  new: 'border-border bg-muted/40 text-muted-foreground',
  indeterminate: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  done: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  undefined: 'border-border bg-muted/40 text-muted-foreground',
};

type TaskRowProps = {
  item: DashboardItem;
  t: Messages;
  /** Appeared or changed since the last acknowledged look. */
  isNew?: boolean;
  /** BCP 47 tag for dates and relative times. */
  tag: string;
  /** Shown dimmed, with a restore button, when the row is a dismissed one. */
  dismissed?: boolean;
  onDismiss?: (item: DashboardItem) => void;
  onRestore?: (issueKey: string) => void;
};

export function TaskRow({
  item,
  t,
  tag,
  isNew = false,
  dismissed = false,
  onDismiss,
  onRestore,
}: TaskRowProps) {
  const { issue, mention } = item;
  const canDismiss = item.kind === 'mention';
  // The dialog trigger only shows up when the preview really is cut off.
  const [commentRef, commentClamped] = useClamped<HTMLSpanElement>(mention?.text ?? '');

  return (
    <div
      className={cn(
        'group grid grid-cols-[auto_1fr_auto] items-start gap-x-3 gap-y-1 border-t border-border/60 px-3 py-2 text-sm hover:bg-muted/30',
        item.overdue && !dismissed && 'bg-red-500/6 dark:bg-red-500/4',
        isNew && !dismissed && 'border-l-2 border-l-sky-500/70',
        dismissed && 'opacity-45',
      )}
    >
      {/* Which source this row comes from — the whole point of the dashboard. */}
      <div className="flex items-center gap-2 pt-0.5">
        {item.kind === 'mention' ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex size-5 items-center justify-center rounded border border-violet-500/40 bg-violet-500/15 text-violet-700 dark:text-violet-300">
                <AtSign className="size-3" />
              </span>
            </TooltipTrigger>
            <TooltipContent>{t.row.mentionBadge}</TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex size-5 items-center justify-center rounded border border-border bg-muted/50 text-muted-foreground">
                <MessageSquareReply className="size-3 rotate-180" />
              </span>
            </TooltipTrigger>
            <TooltipContent>{t.row.assignedBadge}</TooltipContent>
          </Tooltip>
        )}

        <a
          href={issue.url}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-xs text-primary hover:underline"
        >
          {issue.key}
        </a>
      </div>

      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          {isNew ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  data-new-badge
                  className="h-4 shrink-0 border-sky-500/50 bg-sky-500/15 px-1 text-[9px] uppercase tracking-wide text-sky-700 dark:text-sky-300"
                >
                  {t.updates.badge}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>{t.updates.badgeTooltip}</TooltipContent>
            </Tooltip>
          ) : null}
          <a
            href={issue.url}
            target="_blank"
            rel="noreferrer"
            className="truncate font-medium hover:underline"
            title={issue.summary}
          >
            {issue.summary}
          </a>
          {issue.parentKey ? (
            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
              ↳ {issue.parentKey}
            </span>
          ) : null}
        </div>

        {mention ? (
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="text-violet-700 dark:text-violet-300">{mention.byDisplayName}</span>
            <span className="opacity-50">·</span>
            <span>{formatRelative(mention.at, tag)}</span>
            <span className="opacity-50">·</span>
            <span ref={commentRef} className="line-clamp-2 max-w-[70ch] italic">
              {mention.text || t.row.emptyComment}
            </span>
            {commentClamped ? (
              <CommentDialog issueKey={issue.key} mention={mention} t={t} tag={tag} />
            ) : null}
            <a
              href={mention.commentUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              {t.row.goToComment}
              <ExternalLink className="size-3" />
            </a>
          </div>
        ) : null}

        {issue.labels.length ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {issue.labels.slice(0, 4).map((label) => (
              <span
                key={label}
                className="rounded bg-muted/50 px-1 py-px font-mono text-[10px] text-muted-foreground"
              >
                {label}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                'hidden w-44 truncate text-right text-[11px] lg:inline',
                item.board.kind === 'board'
                  ? 'text-muted-foreground'
                  : 'italic text-amber-700/80 dark:text-amber-400/70',
              )}
            >
              {item.board.kind === 'board' ? item.board.label : t.row.boardless(item.board.label)}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {item.board.kind === 'board'
              ? item.board.label
              : t.row.boardlessTooltip(item.board.label)}
          </TooltipContent>
        </Tooltip>

        <span className="hidden font-mono text-[10px] text-muted-foreground sm:inline">
          {issue.issueType}
        </span>

        {issue.priority ? (
          <Badge
            variant="outline"
            className={cn('h-5 px-1.5 text-[10px]', PRIORITY_STYLES[issue.priority.name])}
          >
            {issue.priority.name}
          </Badge>
        ) : (
          <Badge variant="outline" className="h-5 px-1.5 text-[10px] text-muted-foreground">
            {t.row.noPriority}
          </Badge>
        )}

        <Badge
          variant="outline"
          className={cn('h-5 px-1.5 text-[10px]', STATUS_STYLES[issue.status.category])}
        >
          {issue.status.name}
        </Badge>

        <span
          className={cn(
            'inline-flex w-22 items-center justify-end gap-1 font-mono text-[11px]',
            item.overdue && 'font-semibold text-red-600 dark:text-red-400',
            item.dueSoon && 'text-amber-600 dark:text-amber-300',
            !item.overdue && !item.dueSoon && 'text-muted-foreground',
          )}
        >
          {issue.duedate ? (
            <>
              <CalendarClock className="size-3" />
              {formatDueDate(issue.duedate, tag)}
            </>
          ) : (
            <span className="opacity-40">—</span>
          )}
        </span>

        {issue.assignee ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Avatar className="size-5">
                {issue.assignee.avatarUrl ? (
                  <AvatarImage src={issue.assignee.avatarUrl} alt="" />
                ) : null}
                <AvatarFallback className="text-[9px]">
                  {initials(issue.assignee.displayName)}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>{issue.assignee.displayName}</TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex size-5 items-center justify-center rounded-full border border-dashed border-border text-[9px] text-muted-foreground">
                ?
              </span>
            </TooltipTrigger>
            <TooltipContent>{t.row.noAssignee}</TooltipContent>
          </Tooltip>
        )}

        {/* Only mentions can be hidden: assigned work is not a notification. */}
        <span className="flex w-6 justify-end">
          {dismissed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={t.row.restoreFor(issue.key)}
                  onClick={() => onRestore?.(issue.key)}
                  className="cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Undo2 className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t.row.restore}</TooltipContent>
            </Tooltip>
          ) : canDismiss ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={t.row.hideFor(issue.key)}
                  onClick={() => onDismiss?.(item)}
                  className="cursor-pointer rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <EyeOff className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t.row.hide}</TooltipContent>
            </Tooltip>
          ) : null}
        </span>
      </div>
    </div>
  );
}
