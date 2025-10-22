import { SkeletonStatsGrid } from '@/components/ui/skeleton-stats';
import { SkeletonCard } from '@/components/ui/skeleton-card';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav skeleton */}
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Skeleton className="h-8 w-48" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </div>
      </header>

      <main className="container mx-auto space-y-8 p-4 py-8">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-9 w-48 mb-2" />
            <Skeleton className="h-5 w-96" />
          </div>
          <Skeleton className="h-10 w-40" />
        </div>

        <SkeletonStatsGrid count={4} />

        <div className="grid gap-8 lg:grid-cols-2">
          <SkeletonCard showHeader={true} contentLines={5} />
          <SkeletonCard showHeader={true} contentLines={5} />
        </div>
      </main>
    </div>
  );
}
