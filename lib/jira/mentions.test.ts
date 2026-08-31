import { describe, expect, it } from 'vitest';

import {
  accountMentions,
  bodyAddressesAccount,
  bodyInformsAccount,
  bodyMentionsAccount,
  bodyToPlainText,
  mentionedAccountIds,
} from './adf';
import {
  analyzeInformationalMention,
  analyzeMentions,
  findUnansweredMention,
  threadMentionsAccount,
} from './mentions';
import type { AdfNode, JiraComment } from './types';

import edgeCases from './__fixtures__/edge-cases.json';
import realAnswered from './__fixtures__/real-thread-answered.json';
import realUnanswered from './__fixtures__/real-thread-unanswered.json';

const TARGET = edgeCases.targetAccountId;
const OTHER = '712020:22222221-2222-2222-2222-222222222222';

const threads = edgeCases.threads as unknown as Record<string, JiraComment[]>;

describe('ADF mention detection', () => {
  it('finds a mention node by accountId', () => {
    expect(bodyMentionsAccount(threads.mentionThenReply[0].body, TARGET)).toBe(true);
  });

  it('finds a mention nested inside panels and lists', () => {
    expect(bodyMentionsAccount(threads.mentionNestedDeep[0].body, TARGET)).toBe(true);
  });

  it('finds a legacy wiki-markup mention', () => {
    expect(bodyMentionsAccount(threads.wikiLegacyMention[0].body, TARGET)).toBe(true);
  });

  it('does not match a mention of somebody else', () => {
    expect(bodyMentionsAccount(threads.otherUserMentioned[0].body, TARGET)).toBe(false);
  });

  it('does not match the accountId appearing as plain text', () => {
    // `comment ~ accountId` in JQL matches this; the ADF check is what rejects it.
    expect(bodyMentionsAccount(threads.accountIdAsPlainText[0].body, TARGET)).toBe(false);
  });

  it('handles empty and missing bodies', () => {
    expect(bodyMentionsAccount(undefined, TARGET)).toBe(false);
    expect(bodyMentionsAccount('', TARGET)).toBe(false);
    expect(bodyMentionsAccount({ type: 'doc' }, TARGET)).toBe(false);
  });

  it('never matches on an empty accountId', () => {
    expect(bodyMentionsAccount(threads.mentionThenReply[0].body, '')).toBe(false);
  });

  it('lists every mentioned accountId', () => {
    expect(mentionedAccountIds(threads.mentionNestedDeep[0].body)).toEqual([TARGET]);
    expect(mentionedAccountIds(threads.wikiLegacyMention[0].body)).toEqual([TARGET]);
    expect(mentionedAccountIds(threads.otherUserMentioned[0].body)).toEqual([
      '712020:22222223-2222-2222-2222-222222222222',
    ]);
  });
});

/**
 * Being on a "fyi" line means being kept in the loop, not being asked anything.
 * Modelled on a real comment: a request aimed at one person, then a separate
 * line listing four others for information.
 */
describe('fyi and cc lines do not need an answer', () => {
  it('ignores a mention on a fyi line that follows a request to someone else', () => {
    expect(bodyAddressesAccount(threads.fyiLineAfterRequest[0].body, TARGET)).toBe(false);
    // Still detected as a mention — it is just not one that asks anything.
    expect(bodyMentionsAccount(threads.fyiLineAfterRequest[0].body, TARGET)).toBe(true);
    expect(analyzeMentions(threads.fyiLineAfterRequest, TARGET)).toBeNull();
  });

  it('ignores a fyi line written with a hard break instead of a new paragraph', () => {
    expect(bodyAddressesAccount(threads.fyiAfterHardBreak[0].body, TARGET)).toBe(false);
  });

  it('handles the common spellings', () => {
    expect(bodyAddressesAccount(threads.fyiWithColon[0].body, TARGET)).toBe(false);
    expect(bodyAddressesAccount(threads.ccLine[0].body, TARGET)).toBe(false);
    expect(bodyAddressesAccount(threads.perConoscenza[0].body, TARGET)).toBe(false);
    expect(bodyAddressesAccount(threads.wikiFyiLine[0].body, TARGET)).toBe(false);
  });

  it('keeps a fyi line that still asks something', () => {
    // Deliberately conservative: hiding a real question is worse than showing
    // one notification too many.
    expect(bodyAddressesAccount(threads.fyiThatStillAsks[0].body, TARGET)).toBe(true);
    expect(analyzeMentions(threads.fyiThatStillAsks, TARGET)?.replied).toBe(false);
  });

  it('falls back to the last mention that did ask something', () => {
    const analysis = analyzeMentions(threads.askedThenFyi, TARGET);
    expect(analysis?.commentId).toBe('26');
    expect(analysis?.replied).toBe(false);
    expect(analysis?.mentionText).toContain('can you review this?');
  });

  it('still counts a normal mention as addressed', () => {
    expect(bodyAddressesAccount(threads.mentionNestedDeep[0].body, TARGET)).toBe(true);
    expect(bodyAddressesAccount(threads.wikiLegacyMention[0].body, TARGET)).toBe(true);
    expect(bodyAddressesAccount(threads.mentionThenReply[0].body, TARGET)).toBe(true);
  });

  it('marks each mention in a body as informational or not', () => {
    expect(accountMentions(threads.fyiLineAfterRequest[0].body, TARGET)).toEqual([
      { informational: true },
    ]);
    expect(accountMentions(threads.mentionThenReply[0].body, TARGET)).toEqual([
      { informational: false },
    ]);
    expect(accountMentions(threads.otherUserMentioned[0].body, TARGET)).toEqual([]);
  });
});

/** A whole comment that is nothing but `<marker> @Target User`. */
function markerBody(marker: string): AdfNode {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: `${marker} ` },
          { type: 'mention', attrs: { id: TARGET, text: '@Target User' } },
        ],
      },
    ],
  };
}

describe('the spellings of a "for information" line', () => {
  it('takes cc exactly as it takes fyi', () => {
    for (const marker of ['cc', 'CC:', 'in cc', 'cc a', 'cc anche', 'in copia']) {
      expect(bodyInformsAccount(markerBody(marker), TARGET)).toBe(true);
      expect(bodyAddressesAccount(markerBody(marker), TARGET)).toBe(false);
    }
  });

  it('covers the same forms in the other two languages', () => {
    for (const marker of ['fyi', 'FYI', 'per conoscenza', 'for information', 'zur Kenntnisnahme']) {
      expect(bodyInformsAccount(markerBody(marker), TARGET)).toBe(true);
    }
  });

  it('stops at the first real word, marker or not', () => {
    for (const marker of ['cc for the deploy', 'fyi can you check', 'in copia trovi il file']) {
      expect(bodyInformsAccount(markerBody(marker), TARGET)).toBe(false);
      expect(bodyAddressesAccount(markerBody(marker), TARGET)).toBe(true);
    }
  });

  it('is not informational when the account is not mentioned at all', () => {
    expect(bodyInformsAccount(threads.otherUserMentioned[0].body, TARGET)).toBe(false);
    expect(bodyInformsAccount(undefined, TARGET)).toBe(false);
  });

  it('lets one question outweigh a cc in the same comment', () => {
    // Being cc'd at the bottom does not undo a question further up.
    expect(bodyInformsAccount(threads.fyiThatStillAsks[0].body, TARGET)).toBe(false);
  });
});

/**
 * The "fyi" mentions are not dropped any more: they are reported separately, so
 * the UI can file them under their own group instead of hiding them.
 */
describe('mentions kept only for information', () => {
  it('reports the fyi mention that analyzeMentions refuses', () => {
    const analysis = analyzeInformationalMention(threads.fyiLineAfterRequest, TARGET);
    expect(analyzeMentions(threads.fyiLineAfterRequest, TARGET)).toBeNull();
    expect(analysis?.informational).toBe(true);
    expect(analysis?.replied).toBe(false);
    expect(analysis?.commentId).toBe(threads.fyiLineAfterRequest[0].id);
    // The whole comment is there to read, request line included.
    expect(analysis?.mentionText).toContain('fyi');
  });

  it('reports a cc line the same way', () => {
    expect(analyzeInformationalMention(threads.ccLine, TARGET)?.informational).toBe(true);
    expect(analyzeInformationalMention(threads.perConoscenza, TARGET)?.informational).toBe(true);
    expect(analyzeInformationalMention(threads.wikiFyiLine, TARGET)?.informational).toBe(true);
  });

  it('finds nothing where the mention actually asks something', () => {
    expect(analyzeInformationalMention(threads.mentionNestedDeep, TARGET)).toBeNull();
    expect(analyzeInformationalMention(threads.fyiThatStillAsks, TARGET)).toBeNull();
  });

  it('ignores a fyi the target user wrote themselves', () => {
    expect(analyzeInformationalMention(threads.selfMentionOnly, TARGET)).toBeNull();
  });

  it('leaves the choice to the caller when a thread does both', () => {
    // Asked at 26, then merely kept in the loop: the question is the answer the
    // scan wants, and it is the one it asks for first.
    expect(analyzeMentions(threads.askedThenFyi, TARGET)?.commentId).toBe('26');
    expect(analyzeInformationalMention(threads.askedThenFyi, TARGET)?.commentId).not.toBe('26');
  });

  it('counts a later comment of your own as having read it', () => {
    const read: JiraComment[] = [
      threads.fyiLineAfterRequest[0],
      {
        ...threads.mentionThenReply[1],
        id: '900',
        created: '2026-08-20T09:00:00.000+0200',
      },
    ];

    expect(read[1].author.accountId).toBe(TARGET);
    expect(analyzeInformationalMention(read, TARGET)?.replied).toBe(true);
  });
});

describe('comment preview text', () => {
  it('renders mentions as @name and keeps the surrounding words', () => {
    expect(bodyToPlainText(threads.mentionNestedDeep[0].body)).toBe(
      'please review @Target User thanks',
    );
  });

  it('flattens a legacy wiki body without leaking the accountId', () => {
    const text = bodyToPlainText(threads.wikiLegacyMention[0].body);
    expect(text).toBe('Hey @user can you look at this?');
    expect(text).not.toContain(TARGET);
  });

  it('collapses spaces but keeps one line break per block', () => {
    // The row preview shows the breaks as spaces; the full-comment dialog needs
    // them, or a list of questions arrives as one unreadable blob.
    const body: AdfNode = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'can you   check' }] },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'the first point' }] }],
            },
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'the second one' }] }],
            },
          ],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'thanks' },
            { type: 'hardBreak' },
            { type: 'text', text: 'Marco' },
          ],
        },
      ],
    };

    expect(bodyToPlainText(body)).toBe(
      'can you check\nthe first point\nthe second one\nthanks\nMarco',
    );
  });

  it('returns an empty string for a missing body', () => {
    expect(bodyToPlainText(undefined)).toBe('');
  });
});

describe('unanswered mention rule', () => {
  it('reports a mention with no reply as unanswered', () => {
    const analysis = analyzeMentions(threads.mentionNestedDeep, TARGET);
    expect(analysis).not.toBeNull();
    expect(analysis?.replied).toBe(false);
    expect(analysis?.mentionedBy.accountId).toBe(OTHER);
    expect(analysis?.commentId).toBe('2');
    expect(findUnansweredMention(threads.mentionNestedDeep, TARGET)).not.toBeNull();
  });

  it('treats a later comment by the target user as a reply', () => {
    const analysis = analyzeMentions(threads.mentionThenReply, TARGET);
    expect(analysis?.replied).toBe(true);
    expect(findUnansweredMention(threads.mentionThenReply, TARGET)).toBeNull();
  });

  it('uses the LAST mention, so a fresh ping after a reply counts again', () => {
    const analysis = analyzeMentions(threads.replyThenMentionedAgain, TARGET);
    expect(analysis?.commentId).toBe('9');
    expect(analysis?.replied).toBe(false);
    expect(analysis?.mentionText).toContain('second ping');
  });

  it('ignores a mention the target user wrote themselves', () => {
    expect(analyzeMentions(threads.selfMentionOnly, TARGET)).toBeNull();
    expect(threadMentionsAccount(threads.selfMentionOnly, TARGET)).toBe(false);
  });

  it('ignores an accountId that only appears as plain text', () => {
    expect(analyzeMentions(threads.accountIdAsPlainText, TARGET)).toBeNull();
  });

  it('ignores a thread where somebody else was mentioned', () => {
    expect(analyzeMentions(threads.otherUserMentioned, TARGET)).toBeNull();
  });

  it('breaks a same-timestamp tie by comment id, so the reply still counts', () => {
    expect(analyzeMentions(threads.sameTimestampReply, TARGET)?.replied).toBe(true);
  });

  it('does not depend on the order the comments arrive in', () => {
    const reversed = [...threads.replyThenMentionedAgain].reverse();
    expect(analyzeMentions(reversed, TARGET)?.commentId).toBe('9');
  });

  it('returns null for an empty thread', () => {
    expect(analyzeMentions([], TARGET)).toBeNull();
  });
});

describe('real sanitized threads from the instance', () => {
  const unanswered = realUnanswered as unknown as JiraComment[];
  const answered = realAnswered as unknown as JiraComment[];

  it('keeps a real unanswered mention', () => {
    const analysis = analyzeMentions(unanswered, TARGET);
    expect(analysis).not.toBeNull();
    expect(analysis?.replied).toBe(false);
    expect(analysis?.mentionedAt).toBeTruthy();
  });

  it('recognises a real thread the target already replied to', () => {
    const analysis = analyzeMentions(answered, TARGET);
    expect(analysis).not.toBeNull();
    expect(analysis?.replied).toBe(true);
    expect(findUnansweredMention(answered, TARGET)).toBeNull();
  });

  it('finds nothing for an account that is not in the thread', () => {
    expect(analyzeMentions(unanswered, '712020:99999999-9999-9999-9999-999999999999')).toBeNull();
    expect(analyzeMentions(answered, '712020:99999999-9999-9999-9999-999999999999')).toBeNull();
  });
});
