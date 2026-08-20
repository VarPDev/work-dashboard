import { Suspense } from 'react';

import { DashboardView } from '@/components/dashboard/dashboard-view';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { messages, FALLBACK_LOCALE } from '@/lib/i18n';

export default function Page() {
  return (
    // useSearchParams needs a Suspense boundary; the skeleton is the fallback.
    // The real locale is only known in the browser, so this one shortlived
    // fallback uses the default language.
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-[1600px] p-4">
          <DashboardSkeleton label={messages[FALLBACK_LOCALE].list.loading} />
        </div>
      }
    >
      <DashboardView />
    </Suspense>
  );
}
