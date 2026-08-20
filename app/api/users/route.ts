import { NextResponse } from 'next/server';

import { JiraApiError, withJiraCallCounter } from '@/lib/jira/client';
import { getJiraConfig } from '@/lib/jira/env';
import type { ApiError, UsersResponse } from '@/lib/dashboard-types';
import { getSelectableUsers } from '@/lib/jira/users';

export async function GET(): Promise<NextResponse<UsersResponse | ApiError>> {
  try {
    const { defaultAccountId } = getJiraConfig();
    const { result: users, calls } = await withJiraCallCounter(getSelectableUsers);

    console.log(`[api/users] ${users.length} selectable user(s), ${calls} Jira call(s)`);

    return NextResponse.json({ defaultAccountId, users });
  } catch (error) {
    if (error instanceof JiraApiError && error.status === 403) {
      return NextResponse.json(
        {
          error: {
            code: 'browse-users-forbidden',
            message:
              'Jira refused the user directory: the token is missing the global "Browse users" permission. The picker cannot be filled.',
          },
        },
        { status: 403 },
      );
    }

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
