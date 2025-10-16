import { Skeleton } from '@/components/ui/skeleton';

export default function DocsLoadingSkeleton() {
  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header skeleton */}
      <div className="mb-8">
        <Skeleton className="h-10 w-64 mb-2" />
        <Skeleton className="h-6 w-96" />
      </div>

      {/* Tip banner skeleton */}
      <Skeleton className="h-16 w-full mb-8 rounded-lg" />

      {/* Category sections */}
      {[1, 2, 3].map((section) => (
        <div key={section} className="mb-12">
          {/* Category header */}
          <div className="mb-6">
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-5 w-96" />
          </div>

          {/* Doc cards grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((card) => (
              <div
                key={card}
                className="border rounded-lg p-6"
              >
                <div className="flex items-start gap-3 mb-4">
                  <Skeleton className="h-10 w-10 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-6 w-3/4" />
                    <div className="flex gap-2">
                      <Skeleton className="h-5 w-20" />
                      <Skeleton className="h-5 w-24" />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Help section skeleton */}
      <Skeleton className="h-40 w-full rounded-lg" />
    </div>
  );
}
