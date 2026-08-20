/**
 * Atlassian Document Format helpers.
 *
 * A comment body is a tree, and a mention is a node in it:
 *   { type: "mention", attrs: { id: "<accountId>", text: "@Name" } }
 *
 * Detection walks that tree looking for the accountId. It deliberately never
 * matches on displayName: on this instance a displayName search returns nothing
 * anyway, and with a picker over 99 users homonyms are a real risk — this
 * instance has two accounts sharing a first name.
 */

import type { AdfNode } from './types';

/**
 * A line whose only content — mentions aside — is a "for information" marker.
 * Being on such a line means being kept in the loop, not being asked anything:
 *
 *   @Alice can you please update this ticket?
 *   fyi @Bob @Carol @Dave
 *
 * Deliberately strict: the marker has to be the whole line. "fyi @Alice can you
 * check" still counts as addressed, because wrongly hiding a real question
 * is far worse than showing one notification too many.
 */
const INFORMATIONAL_ONLY =
  /^[\s([]*(fyi|f\.y\.i\.?|cc|in cc|per info(rmazione|rmazioni)?|per conoscenza|solo per info(rmazione)?|for info(rmation)?|for your information|for awareness|zur info(rmation)?|nur zur info(rmation)?)[\s:;,.\-–>)\]]*$/i;

/** Inline node types: everything else opens a new line of its own. */
const INLINE_TYPES = new Set([
  'text',
  'mention',
  'emoji',
  'hardBreak',
  'inlineCard',
  'status',
  'date',
  'mediaInline',
]);

/**
 * Split a body into lines of inline nodes. A line ends at a block boundary
 * (paragraph, list item, table cell) or at a hard break, because Jira produces
 * either one depending on whether Enter or Shift+Enter was pressed — and to a
 * reader they are the same thing.
 */
function inlineLines(node: AdfNode): AdfNode[][] {
  const lines: AdfNode[][] = [];
  let current: AdfNode[] = [];

  const flush = (): void => {
    if (current.length) lines.push(current);
    current = [];
  };

  const walk = (candidate: AdfNode): void => {
    if (INLINE_TYPES.has(candidate.type)) {
      if (candidate.type === 'hardBreak') flush();
      else current.push(candidate);
      return;
    }

    flush();
    for (const child of candidate.content ?? []) walk(child);
    flush();
  };

  walk(node);
  flush();
  return lines;
}

/** The words on a line, ignoring the mentions themselves. */
function lineText(nodes: readonly AdfNode[]): string {
  return nodes
    .filter((node) => node.type !== 'mention')
    .map((node) => node.text ?? '')
    .join('');
}

export type AccountMention = {
  /** True when the mention is on a "fyi"/"cc" line and asks for nothing. */
  informational: boolean;
};

/** Legacy wiki-markup mention, still present on old comments. */
function wikiMentions(body: string, accountId: string): boolean {
  return body.includes(`[~accountid:${accountId}]`);
}

function wikiAccountMentions(body: string, accountId: string): AccountMention[] {
  const token = `[~accountid:${accountId}]`;

  return body
    .split(/\r?\n/)
    .filter((line) => line.includes(token))
    .map((line) => ({
      informational: INFORMATIONAL_ONLY.test(line.replace(/\[~accountid:[^\]]+\]/g, '')),
    }));
}

/**
 * Every mention of the account in this body, each flagged as informational or
 * not.
 */
export function accountMentions(
  body: AdfNode | string | undefined,
  accountId: string,
): AccountMention[] {
  if (!body || !accountId) return [];
  if (typeof body === 'string') return wikiAccountMentions(body, accountId);

  const found: AccountMention[] = [];

  for (const line of inlineLines(body)) {
    const mentionsTarget = line.filter(
      (node) => node.type === 'mention' && node.attrs?.id === accountId,
    ).length;
    if (mentionsTarget === 0) {
      // The wiki form can still sit inside a plain text node on old comments.
      const legacy = line.filter(
        (node) => node.type === 'text' && node.text && wikiMentions(node.text, accountId),
      ).length;
      if (legacy === 0) continue;
    }

    const informational = INFORMATIONAL_ONLY.test(lineText(line));
    const count = mentionsTarget || 1;
    for (let index = 0; index < count; index += 1) found.push({ informational });
  }

  return found;
}

/**
 * Does this comment actually ask the account something? A mention that only
 * appears on a "fyi" line does not.
 */
export function bodyAddressesAccount(
  body: AdfNode | string | undefined,
  accountId: string,
): boolean {
  return accountMentions(body, accountId).some((mention) => !mention.informational);
}

/** Does this comment body mention the given account? */
export function bodyMentionsAccount(body: AdfNode | string | undefined, accountId: string): boolean {
  if (!body || !accountId) return false;
  if (typeof body === 'string') return wikiMentions(body, accountId);

  if (body.type === 'mention' && body.attrs?.id === accountId) return true;

  // Some older payloads keep the wiki form inside a text node.
  if (body.type === 'text' && body.text && wikiMentions(body.text, accountId)) return true;

  return (body.content ?? []).some((child) => bodyMentionsAccount(child, accountId));
}

/** Every accountId mentioned in a body, for debugging and fixtures. */
export function mentionedAccountIds(body: AdfNode | string | undefined): string[] {
  if (!body) return [];
  if (typeof body === 'string') {
    return [...body.matchAll(/\[~accountid:([^\]]+)\]/g)].map((match) => match[1]);
  }

  const found: string[] = [];
  if (body.type === 'mention' && typeof body.attrs?.id === 'string') {
    found.push(body.attrs.id);
  }
  for (const child of body.content ?? []) {
    found.push(...mentionedAccountIds(child));
  }
  return found;
}

const BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'listItem',
  'blockquote',
  'codeBlock',
  'panel',
  'tableRow',
  'rule',
]);

/**
 * Flatten a body to plain text for the comment preview in the UI. Not a full
 * ADF renderer — it keeps mentions and emoji readable and drops the rest.
 */
export function bodyToPlainText(body: AdfNode | string | undefined): string {
  if (!body) return '';
  if (typeof body === 'string') {
    return body.replace(/\[~accountid:[^\]]+\]/g, '@user').replace(/\s+/g, ' ').trim();
  }

  const parts: string[] = [];

  const walk = (node: AdfNode): void => {
    switch (node.type) {
      case 'text':
        parts.push(node.text ?? '');
        return;
      case 'mention': {
        const label = typeof node.attrs?.text === 'string' ? node.attrs.text : '';
        parts.push(label.startsWith('@') ? label : `@${label || 'user'}`);
        return;
      }
      case 'emoji': {
        const shortName = node.attrs?.shortName;
        parts.push(typeof shortName === 'string' ? shortName : '');
        return;
      }
      case 'hardBreak':
        parts.push(' ');
        return;
      case 'inlineCard': {
        const url = node.attrs?.url;
        parts.push(typeof url === 'string' ? url : '');
        return;
      }
      default:
        break;
    }

    for (const child of node.content ?? []) walk(child);
    if (BLOCK_TYPES.has(node.type)) parts.push(' ');
  };

  walk(body);
  return parts.join('').replace(/\s+/g, ' ').trim();
}
