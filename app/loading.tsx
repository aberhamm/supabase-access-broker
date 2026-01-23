import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonCard } from '@/components/ui/skeleton-card';

export default function RootLoading() {
  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto space-y-6 p-4 py-8">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-72" />
        </div>

        <SkeletonCard showHeader={true} contentLines={6} />
      </main>
    </div>
  );
}
