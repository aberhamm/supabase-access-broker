'use client';

import { Badge } from '@/components/ui/badge';
import { Server, Workflow, Database, Globe } from 'lucide-react';

interface ExternalSourceBadgeProps {
  source: 'local' | 'n8n' | 'django' | 'generic';
  sourceName?: string;
}

const sourceConfig = {
  local: {
    label: 'Local',
    icon: Server,
    variant: 'default' as const,
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  },
  n8n: {
    label: 'n8n',
    icon: Workflow,
    variant: 'secondary' as const,
    className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  },
  django: {
    label: 'Django',
    icon: Database,
    variant: 'secondary' as const,
    className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  },
  generic: {
    label: 'External',
    icon: Globe,
    variant: 'outline' as const,
    className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  },
};

export function ExternalSourceBadge({ source, sourceName }: ExternalSourceBadgeProps) {
  const config = sourceConfig[source] || sourceConfig.generic;
  const Icon = config.icon;
  const displayName = sourceName || config.label;

  return (
    <Badge
      variant={config.variant}
      className={`gap-1.5 ${config.className}`}
      title={source !== 'local' ? `External source: ${displayName}` : 'Managed locally'}
    >
      <Icon className="h-3 w-3" />
      {displayName}
    </Badge>
  );
}

