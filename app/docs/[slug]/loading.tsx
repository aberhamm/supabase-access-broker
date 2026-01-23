import { Skeleton } from '@/components/ui/skeleton';

export default function DocLoadingSkeleton() {
  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Breadcrumb skeleton */}
      <div className="flex items-center gap-2 mb-6">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-40" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_250px] gap-8">
        {/* Main content */}
        <div className="min-w-0">
          {/* Header skeleton */}
          <div className="mb-8">
            <div className="flex gap-2 mb-3">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-6 w-28" />
            </div>

            <Skeleton className="h-10 w-3/4 mb-2" />
            <Skeleton className="h-6 w-full mb-4" />

            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-10 w-36" />
              <Skeleton className="h-10 w-36" />
            </div>
          </div>

          {/* Content skeleton */}
          <div className="space-y-4">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />

            <div className="pt-4">
              <Skeleton className="h-6 w-1/3" />
              <div className="space-y-2 mt-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>

            <div className="pt-4">
              <Skeleton className="h-40 w-full rounded-md" />
            </div>

            <div className="space-y-2 pt-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>

            <div className="pt-4">
              <Skeleton className="h-6 w-1/3" />
              <div className="space-y-2 mt-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>

            <div className="pt-4">
              <Skeleton className="h-32 w-full rounded-md" />
            </div>
          </div>

          {/* Related docs skeleton */}
          <div className="mt-12 pt-8 border-t">
            <Skeleton className="h-6 w-72 mb-4" />
            <div className="grid gap-4 md:grid-cols-3">
              {[1, 2, 3].map((card) => (
                <div key={card} className="border rounded-lg p-4">
                  <Skeleton className="h-5 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Table of contents skeleton */}
        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <Skeleton className="h-5 w-24 mb-4" />
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
