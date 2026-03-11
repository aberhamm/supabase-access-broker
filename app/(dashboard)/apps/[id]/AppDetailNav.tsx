'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Key, Shield, LayoutDashboard, Link2, Lock } from 'lucide-react';

interface AppDetailNavProps {
  appId: string;
}

const tabs = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, href: '' },
  { id: 'roles', label: 'Roles', icon: Shield, href: '/roles' },
  { id: 'api-keys', label: 'API Keys', icon: Key, href: '/api-keys' },
  { id: 'sso', label: 'SSO', icon: Link2, href: '/sso' },
  { id: 'auth-methods', label: 'Auth', icon: Lock, href: '/auth-methods' },
];

export function AppDetailNav({ appId }: AppDetailNavProps) {
  const pathname = usePathname();
  const basePath = `/apps/${appId}`;

  const getActiveTab = () => {
    if (pathname === basePath || pathname === `${basePath}/`) {
      return 'overview';
    }
    for (const tab of tabs) {
      if (tab.href && pathname.startsWith(`${basePath}${tab.href}`)) {
        return tab.id;
      }
    }
    return 'overview';
  };

  const activeTab = getActiveTab();

  return (
    <div className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground max-w-2xl w-full">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        const href = `${basePath}${tab.href}`;

        return (
          <Link
            key={tab.id}
            href={href}
            className={cn(
              'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 flex-1 gap-2',
              isActive
                ? 'bg-background text-foreground shadow-sm'
                : 'hover:bg-background/50 hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
