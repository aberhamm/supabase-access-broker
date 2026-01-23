import { Skeleton } from '@/components/ui/skeleton';

export default function RolesLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
