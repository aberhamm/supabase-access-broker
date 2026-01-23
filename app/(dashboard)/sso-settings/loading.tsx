import { SkeletonStatsGrid } from '@/components/ui/skeleton-stats';
import { SkeletonCard } from '@/components/ui/skeleton-card';
import { Skeleton } from '@/components/ui/skeleton';

export default function SSOSettingsLoading() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="h-9 w-48 mb-2" />
        <Skeleton className="h-5 w-96" />
      </div>

      <SkeletonStatsGrid count={3} className="md:grid-cols-3 lg:grid-cols-3" />

      <SkeletonCard showHeader={true} contentLines={6} />

      <SkeletonCard showHeader={true} contentLines={4} />
    </div>
  );
}
