'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Shield, Key, Calendar, Copy, Check } from 'lucide-react';
import { getUnifiedApiKeys } from '@/app/actions/api-keys';
import type { AppConfig } from '@/types/claims';

interface OverviewTabContentProps {
  app: AppConfig;
}

interface Stats {
  appRoles: number;
  globalRoles: number;
  apiKeys: number;
  localKeys: number;
  externalKeys: number;
}

export function OverviewTabContent({ app }: OverviewTabContentProps) {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadStats() {
      try {
        const [rolesResponse, keysData] = await Promise.all([
          fetch(`/api/apps/${app.id}/roles`),
          getUnifiedApiKeys(app.id),
        ]);

        if (!rolesResponse.ok) throw new Error('Failed to load roles');
        const rolesData = await rolesResponse.json();

        const appRoles = rolesData.filter(
          (r: { is_global: boolean; app_id: string }) => !r.is_global && r.app_id === app.id
        ).length;
        const globalRoles = rolesData.filter((r: { is_global: boolean }) => r.is_global).length;

        setStats({
          appRoles,
          globalRoles,
          apiKeys: keysData.length,
          localKeys: keysData.filter((k) => k.is_local).length,
          externalKeys: keysData.filter((k) => !k.is_local).length,
        });
      } catch (error) {
        console.error('Failed to load stats:', error);
        setStats({
          appRoles: 0,
          globalRoles: 0,
          apiKeys: 0,
          localKeys: 0,
          externalKeys: 0,
        });
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, [app.id]);

  const copyAppId = async () => {
    await navigator.clipboard.writeText(app.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card
          className="cursor-pointer transition-colors hover:bg-muted/50"
          onClick={() => router.push(`/apps/${app.id}/roles`)}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              App Roles
            </CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.appRoles ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              +{stats?.globalRoles ?? 0} global roles available
            </p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer transition-colors hover:bg-muted/50"
          onClick={() => router.push(`/apps/${app.id}/api-keys`)}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              API Keys
            </CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.apiKeys ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.localKeys ?? 0} local, {stats?.externalKeys ?? 0} external
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Created
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {new Date(app.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Updated {new Date(app.updated_at).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* App Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Application Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <dt className="text-sm font-medium text-muted-foreground">App ID</dt>
              <dd className="flex items-center gap-2">
                <code className="rounded bg-muted px-2 py-1 text-sm font-mono">
                  {app.id}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={copyAppId}
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </dd>
            </div>

            {app.description && (
              <div className="space-y-1 sm:col-span-2">
                <dt className="text-sm font-medium text-muted-foreground">Description</dt>
                <dd className="text-sm">{app.description}</dd>
              </div>
            )}

            <div className="space-y-1">
              <dt className="text-sm font-medium text-muted-foreground">Webhook URL</dt>
              <dd className="flex items-center gap-2">
                <code className="rounded bg-muted px-2 py-1 text-xs font-mono truncate max-w-[200px]">
                  /api/webhooks/{app.id}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => {
                    navigator.clipboard.writeText(`/api/webhooks/${app.id}`);
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </dd>
            </div>

            <div className="space-y-1">
              <dt className="text-sm font-medium text-muted-foreground">Status</dt>
              <dd>
                {app.enabled ? (
                  <Badge variant="default" className="bg-green-600">Active</Badge>
                ) : (
                  <Badge variant="secondary">Disabled</Badge>
                )}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
