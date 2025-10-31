import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface SkeletonCardProps {
  showHeader?: boolean;
  contentLines?: number;
}

export function SkeletonCard({ showHeader = true, contentLines = 3 }: SkeletonCardProps) {
  return (
    <Card>
      {showHeader && (
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
      )}
      <CardContent className="space-y-3">
        {Array.from({ length: contentLines }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}





