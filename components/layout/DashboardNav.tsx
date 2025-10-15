'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogOut, LayoutDashboard, Users, AppWindow } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardNavProps {
  email: string;
  logoutAction: () => Promise<void>;
  showApps?: boolean;
}

export function DashboardNav({ email, logoutAction, showApps = true }: DashboardNavProps) {
  const pathname = usePathname();

  const navItems = [
    {
      href: '/',
      label: 'Dashboard',
      icon: LayoutDashboard,
      active: pathname === '/',
    },
    {
      href: '/users',
      label: 'Users',
      icon: Users,
      active: pathname?.startsWith('/users'),
    },
  ];

  if (showApps) {
    navItems.push({
      href: '/apps',
      label: 'Apps',
      icon: AppWindow,
      active: pathname?.startsWith('/apps'),
    });
  }

  return (
    <header className="border-b bg-background">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <div>
            <h1 className="text-xl font-bold">Claims Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">{email}</p>
          </div>

          <nav className="hidden md:flex items-center gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={item.active ? 'default' : 'ghost'}
                    size="sm"
                    className={cn(
                      'gap-2',
                      item.active && 'pointer-events-none'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>
        </div>

        <form action={logoutAction}>
          <Button variant="ghost" size="sm" type="submit">
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </form>
      </div>
    </header>
  );
}
