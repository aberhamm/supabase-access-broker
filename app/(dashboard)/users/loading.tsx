import { Card, CardContent } from '@/components/ui/card';

export default function UsersLoading() {
  return (
    <div className="space-y-8">
      {/* Page Header Skeleton */}
      <div className="space-y-4">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2">
          <div className="skeleton h-4 w-4 rounded" />
          <div className="skeleton h-4 w-4 rounded" />
          <div className="skeleton h-4 w-20" />
        </div>

        {/* Title and Action */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-2 flex-1">
            <div className="skeleton h-9 w-32" />
            <div className="skeleton h-5 w-80" />
          </div>
          <div className="skeleton h-10 w-32 rounded-lg" />
        </div>
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="skeleton h-9 w-9 rounded-lg shrink-0" />
                  <div className="skeleton h-4 w-24" />
                </div>
              </div>
              <div className="flex items-end justify-between">
                <div className="skeleton h-9 w-16" />
                <div className="skeleton h-5 w-12" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table Container Skeleton */}
      <div className="space-y-4">
        {/* Search and Filters Bar */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="skeleton h-10 w-full sm:flex-1 rounded-lg" />
            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
              <div className="skeleton h-9 w-24 rounded-lg" />
              <div className="flex items-center gap-1 border rounded-lg p-1">
                <div className="skeleton h-8 w-8 rounded" />
                <div className="skeleton h-8 w-8 rounded" />
                <div className="skeleton h-8 w-8 rounded" />
              </div>
            </div>
          </div>
        </div>

        {/* Table Skeleton */}
        <div className="rounded-md border overflow-x-auto">
          <div className="bg-muted/50 min-w-[800px]">
            {/* Table Header */}
            <div className="grid grid-cols-6 gap-4 p-4 border-b">
              <div className="skeleton h-4 w-16" />
              <div className="skeleton h-4 w-16" />
              <div className="skeleton h-4 w-16" />
              <div className="skeleton h-4 w-16" />
              <div className="skeleton h-4 w-24" />
              <div className="skeleton h-4 w-16 ml-auto" />
            </div>

            {/* Table Rows */}
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
              <div key={i} className="grid grid-cols-6 gap-4 p-4 border-b last:border-b-0">
                {/* User Column */}
                <div className="flex items-center gap-3">
                  <div className="skeleton h-9 w-9 rounded-full shrink-0" />
                  <div className="space-y-2">
                    <div className="skeleton h-4 w-32" />
                    <div className="skeleton h-3 w-16" />
                  </div>
                </div>

                {/* User ID */}
                <div className="flex items-center">
                  <div className="skeleton h-6 w-20 rounded" />
                </div>

                {/* Claims */}
                <div className="flex items-center">
                  <div className="skeleton h-6 w-8 rounded-full" />
                </div>

                {/* Status */}
                <div className="flex items-center gap-2">
                  <div className="skeleton h-2 w-2 rounded-full" />
                  <div className="skeleton h-4 w-16" />
                </div>

                {/* Last Sign In */}
                <div className="flex items-center">
                  <div className="skeleton h-4 w-20" />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end">
                  <div className="skeleton h-8 w-16 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
