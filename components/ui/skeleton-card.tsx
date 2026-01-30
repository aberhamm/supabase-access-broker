import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface SkeletonCardProps {
  showHeader?: boolean;
  contentLines?: number;
}

export function SkeletonCard({ showHeader = true, contentLines = 3 }: SkeletonCardProps) {
  return (
    <Card>
      {showHeader && (
        <CardHeader>
          <div className="skeleton h-6 w-32" />
        </CardHeader>
      )}
      <CardContent className="space-y-3">
        {Array.from({ length: contentLines }).map((_, i) => (
          <div key={i} className="skeleton h-4 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}







