import { SkeletonCard } from '@/components/ui/skeleton-card';
import { Skeleton } from '@/components/ui/skeleton';

export default function AppDetailLoading() {
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
        {/* Breadcrumb skeleton */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-24" />
        </div>

        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-lg" />
            <div>
              <Skeleton className="h-9 w-48 mb-2" />
              <Skeleton className="h-5 w-64" />
            </div>
          </div>
        </div>

        {/* Status card */}
        <SkeletonCard showHeader={true} contentLines={2} />

        {/* Tabs */}
        <div className="space-y-6">
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
          </div>
          <SkeletonCard showHeader={true} contentLines={6} />
        </div>
      </main>
    </div>
  );
}
