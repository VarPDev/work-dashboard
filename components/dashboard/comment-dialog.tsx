'use client';

import { Ellipsis, ExternalLink } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { DashboardMention } from '@/lib/dashboard-types';
import { formatRelative } from '@/lib/format';
import type { Messages } from '@/lib/i18n';

type CommentDialogProps = {
  issueKey: string;
  mention: DashboardMention;
  t: Messages;
  /** BCP 47 tag for the relative time. */
  tag: string;
};

/**
 * The whole comment, for when the two-line preview in the row is not enough.
 *
 * Reading it here costs nothing: the text is already in the payload, so this
 * never touches Jira. The link to the real comment stays, because answering
 * still happens over there.
 */
export function CommentDialog({ issueKey, mention, t, tag }: CommentDialogProps) {
  return (
    <Dialog>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <button
              type="button"
              aria-label={t.row.fullCommentFor(issueKey)}
              className="inline-flex h-4 cursor-pointer items-center self-end rounded border border-border bg-muted/40 px-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
            >
              <Ellipsis className="size-3" />
            </button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>{t.row.fullComment}</TooltipContent>
      </Tooltip>

      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-mono">{t.row.commentOn(issueKey)}</DialogTitle>
          <DialogDescription>
            <span className="text-violet-700 dark:text-violet-300">{mention.byDisplayName}</span>
            <span className="px-1 opacity-50">·</span>
            {formatRelative(mention.at, tag)}
          </DialogDescription>
        </DialogHeader>

        {/* Line breaks are kept, so a list stays a list instead of one blob. */}
        <p
          data-comment-body
          className="max-h-[55vh] overflow-y-auto whitespace-pre-wrap break-words leading-relaxed"
        >
          {mention.text || t.row.emptyComment}
        </p>

        <DialogFooter className="sm:items-center sm:justify-between">
          <a
            href={mention.commentUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            {t.row.goToComment}
            <ExternalLink className="size-3" />
          </a>
          <DialogClose asChild>
            <Button variant="outline" size="sm">
              {t.row.close}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
