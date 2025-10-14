import { Badge } from '@/components/ui/badge';
import { getClaimType } from '@/lib/claims';

interface ClaimBadgeProps {
  value: unknown;
}

export function ClaimBadge({ value }: ClaimBadgeProps) {
  const type = getClaimType(value);

  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    string: 'default',
    number: 'secondary',
    boolean: 'outline',
    array: 'default',
    object: 'default',
    null: 'destructive',
  };

  return (
    <Badge variant={variants[type] || 'default'} className="font-mono text-xs">
      {type}
    </Badge>
  );
}
