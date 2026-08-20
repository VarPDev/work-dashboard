import { Skeleton } from '@/components/ui/skeleton';

/** Shape of the real thing, so the page does not jump when data lands. */
export function DashboardSkeleton({ label }: { label: string }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label={label}>
      {[6, 4, 3].map((rows, groupIndex) => (
        <div key={groupIndex} className="overflow-hidden rounded-md border border-border bg-card">
          <div className="flex items-center gap-2 px-3 py-2">
            <Skeleton className="size-4 rounded" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="ml-auto h-5 w-8 rounded-full" />
          </div>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <div
              key={rowIndex}
              className="flex items-center gap-3 border-t border-border/60 px-3 py-2.5"
            >
              <Skeleton className="size-5 rounded" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 flex-1" style={{ maxWidth: `${40 + rowIndex * 7}%` }} />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-3 w-12" />
              <Skeleton className="size-5 rounded-full" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
