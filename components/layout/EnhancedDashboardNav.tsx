'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  LogOut,
  LayoutDashboard,
  Users,
  AppWindow,
  BookOpen,
  Link2,
  Bell,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/theme-toggle';
import { Badge } from '@/components/ui/badge';

interface EnhancedDashboardNavProps {
  email: string;
  showApps?: boolean;
  notificationCount?: number;
}

export function EnhancedDashboardNav({
  email,
  showApps = true,
  notificationCount = 0,
}: EnhancedDashboardNavProps) {
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

    navItems.push({
      href: '/sso-settings',
      label: 'SSO',
      icon: Link2,
      active: pathname?.startsWith('/sso-settings'),
    });
  }

  navItems.push({
    href: '/docs',
    label: 'Docs',
    icon: BookOpen,
    active: pathname?.startsWith('/docs'),
  });

  // Get first letter of email for avatar
  const avatarLetter = email.charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Left: Logo and Navigation */}
          <div className="flex items-center gap-8 flex-1 min-w-0">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 shrink-0 group">
              <div className="relative">
                <div className="h-10 w-10 rounded-lg bg-linear-to-br from-primary to-primary/60 flex items-center justify-center font-bold text-primary-foreground shadow-lg ring-2 ring-primary/20 group-hover:ring-primary/40 transition-all">
                  S
                </div>
                <div className="absolute -inset-1 bg-linear-to-br from-primary to-primary/60 rounded-lg opacity-0 group-hover:opacity-20 blur transition-opacity" />
              </div>
              <div className="hidden lg:block">
                <h1 className="text-lg font-bold tracking-tight">access broker</h1>
                <p className="text-xs text-muted-foreground">Supabase</p>
              </div>
            </Link>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} className="relative group">
                    <Button
                      variant={item.active ? 'secondary' : 'ghost'}
                      size="sm"
                      className={cn(
                        'gap-2 relative transition-all',
                        item.active && 'bg-primary/10 text-primary hover:bg-primary/15'
                      )}
                      aria-current={item.active ? 'page' : undefined}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Button>
                    {item.active && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right: Actions and User Menu */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Search / Command Palette Trigger */}
            <Button
              variant="outline"
              size="sm"
              className="hidden lg:flex gap-2 text-muted-foreground hover:text-foreground"
            >
              <Search className="h-4 w-4" />
              <span className="text-xs">Search</span>
              <kbd className="kbd-hint ml-1">⌘K</kbd>
            </Button>

            {/* Notifications */}
            <Button
              variant="ghost"
              size="sm"
              className="relative"
              aria-label={`${notificationCount} notifications`}
            >
              <Bell className="h-4 w-4" />
              {notificationCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                >
                  {notificationCount > 9 ? '9+' : notificationCount}
                </Badge>
              )}
            </Button>

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Divider */}
            <div className="h-6 w-px bg-border hidden lg:block" />

            {/* User Menu */}
            <div className="flex items-center gap-2">
              {/* User Avatar & Email */}
              <Link href="/account" className="group hidden lg:flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted transition-colors">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm ring-2 ring-primary/20 group-hover:ring-primary/40 transition-all">
                  {avatarLetter}
                </div>
                <div className="text-sm">
                  <p className="font-medium leading-none mb-0.5">{email.split('@')[0]}</p>
                  <p className="text-xs text-muted-foreground leading-none">
                    @{email.split('@')[1]}
                  </p>
                </div>
              </Link>

              {/* Mobile: Just Avatar */}
              <Link href="/account" className="lg:hidden">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                    {avatarLetter}
                  </div>
                </Button>
              </Link>

              {/* Sign Out */}
              <Link href="/auth/logout" prefetch={false}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 hover:bg-destructive/10 hover:text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden lg:inline">Sign Out</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Mobile Navigation - Slides in on small screens */}
        <nav className="md:hidden flex items-center gap-1 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-hide">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="relative shrink-0">
                <Button
                  variant={item.active ? 'secondary' : 'ghost'}
                  size="sm"
                  className={cn(
                    'gap-2 relative',
                    item.active && 'bg-primary/10 text-primary'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Button>
                {item.active && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
