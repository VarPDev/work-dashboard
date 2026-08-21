import { NextResponse, type NextRequest } from 'next/server';

import type { ApiError } from '@/lib/dashboard-types';
import { resolveTargetUser, UnknownUserError } from '@/lib/jira/users';
import type { SeenState } from '@/lib/seen';
import { getSeen, replaceSeen } from '@/lib/seen-store';

export type SeenResponse = { seen: SeenState };

const ISSUE_KEY = /^[A-Z][A-Z0-9_]*-\d+$/;
/** "comment:<id>" or "updated:<iso>" — long enough for either, no longer. */
const MARKER = /^(comment|updated):[\w:.+-]{1,40}$/;

function badRequest(message: string): NextResponse<ApiError> {
  return NextResponse.json({ error: { code: 'unknown-user', message } }, { status: 400 });
}

/** Validated against Jira before being used as a key, as everywhere else. */
async function accountIdFrom(request: NextRequest): Promise<string> {
  const user = await resolveTargetUser(request.nextUrl.searchParams.get('user'));
  return user.accountId;
}

export async function GET(request: NextRequest): Promise<NextResponse<SeenResponse | ApiError>> {
  try {
    const accountId = await accountIdFrom(request);
    return NextResponse.json({ seen: await getSeen(accountId) });
  } catch (error) {
    if (error instanceof UnknownUserError) return badRequest(error.message);
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[api/seen] ${message}`);
    return NextResponse.json({ error: { code: 'config-error', message } }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<SeenResponse | ApiError>> {
  try {
    const accountId = await accountIdFrom(request);
    const body = (await request.json()) as { seen?: Record<string, unknown> };

    const seen: SeenState = {};
    for (const [key, marker] of Object.entries(body.seen ?? {})) {
      if (ISSUE_KEY.test(key) && typeof marker === 'string' && MARKER.test(marker)) {
        seen[key] = marker;
      }
    }

    return NextResponse.json({ seen: await replaceSeen(accountId, seen) });
  } catch (error) {
    if (error instanceof UnknownUserError) return badRequest(error.message);
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[api/seen] ${message}`);
    return NextResponse.json({ error: { code: 'config-error', message } }, { status: 500 });
  }
}
