import { Suspense } from 'react';

import { DashboardView } from '@/components/dashboard/dashboard-view';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';

export default function Page() {
  return (
    // useSearchParams needs a Suspense boundary; the skeleton is the fallback.
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-[1600px] p-4">
          <DashboardSkeleton />
        </div>
      }
    >
      <DashboardView />
    </Suspense>
  );
}
