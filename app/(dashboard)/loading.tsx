import { SkeletonStatsGrid } from '@/components/ui/skeleton-stats';
import { SkeletonCard } from '@/components/ui/skeleton-card';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-full max-w-md" />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      <SkeletonStatsGrid count={4} />

      <div className="grid gap-8 lg:grid-cols-2">
        <SkeletonCard showHeader={true} contentLines={5} />
        <SkeletonCard showHeader={true} contentLines={5} />
      </div>
    </div>
  );
}
