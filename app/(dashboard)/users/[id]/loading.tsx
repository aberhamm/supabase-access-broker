import { SkeletonCard } from '@/components/ui/skeleton-card';
import { Card } from '@/components/ui/card';

export default function UserDetailLoading() {
  return (
    <div className="space-y-8">
      {/* Hero Header Skeleton */}
      <Card className="p-8">
        <div className="space-y-4">
          <div className="skeleton h-4 w-48 mb-4" />
          <div className="flex items-start gap-6">
            <div className="skeleton h-20 w-20 rounded-2xl shrink-0" />
            <div className="space-y-3 flex-1">
              <div className="skeleton h-8 w-64" />
              <div className="skeleton h-4 w-96" />
              <div className="flex gap-2">
                <div className="skeleton h-6 w-24 rounded-full" />
                <div className="skeleton h-6 w-32 rounded-full" />
                <div className="skeleton h-6 w-20 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Left Sidebar - 4 columns */}
        <div className="space-y-6 lg:col-span-4">
          <SkeletonCard showHeader={true} contentLines={8} />
          <SkeletonCard showHeader={true} contentLines={4} />
          <SkeletonCard showHeader={true} contentLines={3} />
          <SkeletonCard showHeader={true} contentLines={6} />
        </div>

        {/* Main Content - 5 columns */}
        <div className="space-y-6 lg:col-span-5">
          <SkeletonCard showHeader={true} contentLines={5} />
          <SkeletonCard showHeader={true} contentLines={8} />
          <SkeletonCard showHeader={true} contentLines={6} />
        </div>

        {/* Right Sidebar - 3 columns */}
        <div className="space-y-6 lg:col-span-3">
          <SkeletonCard showHeader={true} contentLines={10} />
        </div>
      </div>
    </div>
  );
}
