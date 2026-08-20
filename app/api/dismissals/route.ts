import { NextResponse, type NextRequest } from 'next/server';

import type { ApiError } from '@/lib/dashboard-types';
import type { Dismissals } from '@/lib/dismissals';
import {
  clearDismissals,
  getDismissals,
  removeDismissal,
  replaceDismissals,
  setDismissal,
} from '@/lib/dismissals-store';
import { resolveTargetUser, UnknownUserError } from '@/lib/jira/users';

export type DismissalsResponse = { dismissals: Dismissals };

/** Jira issue keys, so nothing arbitrary ends up as a key in the store. */
const ISSUE_KEY = /^[A-Z][A-Z0-9_]*-\d+$/;
/** Comment ids are numeric on Jira Cloud. */
const COMMENT_ID = /^\d{1,20}$/;

type Body =
  | { action: 'dismiss'; issueKey: string; commentId: string }
  | { action: 'restore'; issueKey: string }
  | { action: 'restore-all' }
  | { action: 'prune'; dismissals: Dismissals };

function badRequest(message: string): NextResponse<ApiError> {
  return NextResponse.json({ error: { code: 'unknown-user', message } }, { status: 400 });
}

/**
 * The accountId is validated against Jira before it is used as a key, the same
 * way /api/tasks does: an unchecked id would let a typo write its own bucket of
 * hidden rows that nothing ever reads again.
 */
async function accountIdFrom(request: NextRequest): Promise<string> {
  const user = await resolveTargetUser(request.nextUrl.searchParams.get('user'));
  return user.accountId;
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse<DismissalsResponse | ApiError>> {
  try {
    const accountId = await accountIdFrom(request);
    return NextResponse.json({ dismissals: await getDismissals(accountId) });
  } catch (error) {
    if (error instanceof UnknownUserError) return badRequest(error.message);
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[api/dismissals] ${message}`);
    return NextResponse.json({ error: { code: 'config-error', message } }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<DismissalsResponse | ApiError>> {
  try {
    const accountId = await accountIdFrom(request);
    const body = (await request.json()) as Body;

    switch (body.action) {
      case 'dismiss': {
        if (!ISSUE_KEY.test(body.issueKey)) return badRequest(`Bad issue key: ${body.issueKey}`);
        if (!COMMENT_ID.test(body.commentId)) return badRequest('Bad comment id.');
        const dismissals = await setDismissal(accountId, body.issueKey, body.commentId);
        console.log(`[api/dismissals] hid ${body.issueKey} for ${accountId}`);
        return NextResponse.json({ dismissals });
      }

      case 'restore': {
        if (!ISSUE_KEY.test(body.issueKey)) return badRequest(`Bad issue key: ${body.issueKey}`);
        return NextResponse.json({ dismissals: await removeDismissal(accountId, body.issueKey) });
      }

      case 'restore-all':
        return NextResponse.json({ dismissals: await clearDismissals(accountId) });

      case 'prune': {
        // Entries a newer comment already invalidated; computed where the items
        // are known, written here.
        const entries = Object.entries(body.dismissals ?? {}).filter(
          ([issueKey, commentId]) =>
            ISSUE_KEY.test(issueKey) && typeof commentId === 'string' && COMMENT_ID.test(commentId),
        );
        return NextResponse.json({
          dismissals: await replaceDismissals(accountId, Object.fromEntries(entries)),
        });
      }

      default:
        return badRequest('Unknown action.');
    }
  } catch (error) {
    if (error instanceof UnknownUserError) return badRequest(error.message);
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[api/dismissals] ${message}`);
    return NextResponse.json({ error: { code: 'config-error', message } }, { status: 500 });
  }
}
