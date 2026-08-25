import { NextResponse } from 'next/server';

import { JiraApiError, withJiraCallCounter } from '@/lib/jira/client';
import { getJiraConfig } from '@/lib/jira/env';
import type { ApiError, UsersResponse } from '@/lib/dashboard-types';
import { getUserDirectory } from '@/lib/jira/users';

export async function GET(): Promise<NextResponse<UsersResponse | ApiError>> {
  try {
    const { defaultAccountId } = getJiraConfig();
    const { result: directory, calls } = await withJiraCallCounter(getUserDirectory);

    console.log(
      `[api/users] ${directory.users.length} selectable user(s), ${calls} Jira call(s)` +
        // A token without "Browse users" gets the default account and nothing
        // else. Worth saying out loud: it explains a picker with one entry.
        (directory.restricted ? ' — restricted to JIRA_DEFAULT_ACCOUNT_ID' : ''),
    );

    return NextResponse.json({ defaultAccountId, ...directory });
  } catch (error) {
    if (error instanceof JiraApiError) {
      console.error(`[api/users] ${error.message}`);
      return NextResponse.json(
        { error: { code: 'jira-error', message: error.messages.join(' | ') || error.message } },
        { status: 502 },
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    console.error(`[api/users] ${message}`);
    return NextResponse.json({ error: { code: 'config-error', message } }, { status: 500 });
  }
}
