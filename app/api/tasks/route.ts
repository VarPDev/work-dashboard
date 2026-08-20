import { NextResponse, type NextRequest } from 'next/server';

import type { ApiError, DashboardPayload } from '@/lib/dashboard-types';
import { JiraApiError } from '@/lib/jira/client';
import { resolveTargetUser, UnknownUserError } from '@/lib/jira/users';
import { getDashboard } from '@/lib/tasks';

export async function GET(
  request: NextRequest,
): Promise<NextResponse<DashboardPayload | ApiError>> {
  const requested = request.nextUrl.searchParams.get('user');
  const refresh = request.nextUrl.searchParams.get('refresh') === '1';

  try {
    // Validated before it can reach a JQL query: an unknown accountId would
    // otherwise produce a perfectly plausible empty dashboard.
    const user = await resolveTargetUser(requested);
    const { payload, fromCache } = await getDashboard(user, { refresh });

    console.log(
      `[api/tasks] ${user.displayName} (${user.accountId}) ` +
        `${fromCache ? 'cache hit' : `fetched, ${payload.diagnostics.jiraCalls} Jira call(s)`}, ` +
        `${payload.totals.assigned} assigned, ${payload.totals.mentions} mentions, ` +
        `${payload.totals.overdue} overdue`,
    );

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof UnknownUserError) {
      return NextResponse.json(
        {
          error: {
            code: 'unknown-user',
            message: `No Jira user matches "${requested ?? ''}". Pick someone from the list.`,
          },
        },
        { status: 400 },
      );
    }

    if (error instanceof JiraApiError) {
      console.error(`[api/tasks] ${error.message}`);
      return NextResponse.json(
        { error: { code: 'jira-error', message: error.messages.join(' | ') || error.message } },
        { status: 502 },
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    console.error(`[api/tasks] ${message}`);
    return NextResponse.json({ error: { code: 'config-error', message } }, { status: 500 });
  }
}
