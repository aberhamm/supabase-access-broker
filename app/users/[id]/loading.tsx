import { SkeletonCard } from '@/components/ui/skeleton-card';
import { Skeleton } from '@/components/ui/skeleton';

export default function UserDetailLoading() {
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
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-20" />
            <div>
              <Skeleton className="h-9 w-48 mb-2" />
              <Skeleton className="h-5 w-64" />
            </div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-1">
            <SkeletonCard showHeader={true} contentLines={6} />
            <SkeletonCard showHeader={true} contentLines={3} />
          </div>

          <div className="lg:col-span-2">
            <div className="space-y-6">
              <SkeletonCard showHeader={true} contentLines={4} />
              <SkeletonCard showHeader={true} contentLines={6} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
