import { Shield, Key, Star, User, CheckCircle2 } from 'lucide-react';

const BADGE_STYLES = {
  admin: {
    bg: 'bg-primary/10',
    text: 'text-primary',
    border: 'border-primary/30',
    icon: Shield,
  },
  role: {
    bg: 'bg-accent-muted',
    text: 'text-accent-vivid',
    border: 'border-accent-vivid/30',
    icon: Key,
  },
  premium: {
    bg: 'bg-warning/10',
    text: 'text-warning',
    border: 'border-warning/30',
    icon: Star,
  },
  verified: {
    bg: 'bg-success/10',
    text: 'text-success',
    border: 'border-success/30',
    icon: CheckCircle2,
  },
  default: {
    bg: 'bg-muted',
    text: 'text-muted-foreground',
    border: 'border-border',
    icon: User,
  },
} as const;

interface EnhancedClaimBadgeProps {
  claim: string;
  variant?: keyof typeof BADGE_STYLES;
}

export function EnhancedClaimBadge({ claim, variant }: EnhancedClaimBadgeProps) {
  // Auto-detect variant based on claim name if not specified
  const detectedVariant = variant || detectVariant(claim);
  const style = BADGE_STYLES[detectedVariant] || BADGE_STYLES.default;
  const Icon = style.icon;

  return (
    <span
      className={`
        badge-enhanced
        ${style.bg} ${style.text} ${style.border}
      `}
    >
      <Icon className="h-3 w-3" />
      {claim}
    </span>
  );
}

function detectVariant(claim: string): keyof typeof BADGE_STYLES {
  const lowerClaim = claim.toLowerCase();

  if (lowerClaim.includes('admin') || lowerClaim.includes('super')) {
    return 'admin';
  }
  if (lowerClaim.includes('premium') || lowerClaim.includes('pro') || lowerClaim.includes('vip')) {
    return 'premium';
  }
  if (lowerClaim.includes('verified') || lowerClaim.includes('approved')) {
    return 'verified';
  }
  if (lowerClaim.includes('role') || lowerClaim.includes('permission')) {
    return 'role';
  }

  return 'default';
}
