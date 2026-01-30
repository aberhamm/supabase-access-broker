import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function SkeletonStats() {
  return (
    <Card>
      <CardHeader>
        <div className="skeleton h-5 w-24" />
      </CardHeader>
      <CardContent>
        <div className="skeleton h-10 w-20 mb-2" />
        <div className="skeleton h-3 w-32" />
      </CardContent>
    </Card>
  );
}

export function SkeletonStatsGrid({
  count = 4,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn('grid gap-6 md:grid-cols-2 lg:grid-cols-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonStats key={i} />
      ))}
    </div>
  );
}







