export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Link2,
  ArrowRight,
  ShieldCheck,
  ShieldX,
  ExternalLink,
} from 'lucide-react';

import { createClient } from '@/lib/supabase/server';
import { isClaimsAdmin } from '@/lib/claims';
import { getApps } from '@/lib/apps-service';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CopyUrlButton } from './CopyUrlButton';

// Logout is now handled by /auth/logout route for reliable cookie clearing

async function checkAdmin() {
  const supabase = await createClient();
  const { data: isAdmin } = await isClaimsAdmin(supabase);
  if (!isAdmin) redirect('/access-denied');
}

function getPortalUrl(): string {
  // Use dedicated auth portal URL if set, otherwise fall back to app URL
  return (
    process.env.NEXT_PUBLIC_AUTH_PORTAL_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:3050'
  );
}

export default async function SSOSettingsPage() {
  await checkAdmin();

  const apps = await getApps();
  const portalUrl = getPortalUrl();

  const configuredCallbacks = apps.filter(
    (a) => (a.allowed_callback_urls ?? []).length > 0
  ).length;
  const configuredSecrets = apps.filter((a) => (a.sso_client_secrets?.length ?? 0) > 0 || !!a.sso_client_secret_hash).length;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Link2 className="h-7 w-7" />
            SSO Settings
          </h2>
          <p className="text-muted-foreground max-w-2xl">
            Manage SSO integration settings across apps. Callback URLs prevent
            open redirects; app secrets can secure code exchange.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total Apps</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{apps.length}</div>
            <p className="text-xs text-muted-foreground">
              Configured applications
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Callback URLs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{configuredCallbacks}</div>
            <p className="text-xs text-muted-foreground">
              Apps with allowlisted callbacks
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>App Secrets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{configuredSecrets}</div>
            <p className="text-xs text-muted-foreground">
              Apps with an exchange secret configured
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">Apps</CardTitle>
            <p className="text-sm text-muted-foreground">
              Open an app’s SSO tab to edit settings.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {apps.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
              No apps found. Create an app first.
            </div>
          ) : (
            <div className="space-y-2">
              {apps.map((app) => {
                const callbackCount = (app.allowed_callback_urls ?? []).length;
                const hasSecret = !!app.sso_client_secret_hash;
                return (
                  <div
                    key={app.id}
                    className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="font-medium truncate">{app.name}</div>
                        <code className="rounded bg-muted px-2 py-0.5 text-xs font-mono">
                          {app.id}
                        </code>
                        {app.enabled ? (
                          <Badge className="bg-green-600 hover:bg-green-600">
                            Enabled
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Disabled</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          {callbackCount > 0 ? (
                            <ShieldCheck className="h-4 w-4" />
                          ) : (
                            <ShieldX className="h-4 w-4" />
                          )}
                          {callbackCount} callback URL
                          {callbackCount === 1 ? '' : 's'}
                        </span>
                        <span className="text-muted-foreground/60">•</span>
                        <span>
                          {(app.sso_client_secrets?.length ?? 0) > 0
                            ? `${app.sso_client_secrets!.length} secret${app.sso_client_secrets!.length === 1 ? '' : 's'}`
                            : hasSecret
                              ? 'Secret configured'
                              : 'No secret'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link href={`/apps/${app.id}/sso`}>
                        <Button variant="default" className="gap-2">
                          Manage
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Portal URL Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ExternalLink className="h-4 w-4" />
            Auth Portal URL
          </CardTitle>
          <CardDescription>
            External apps redirect users to this URL to authenticate via SSO.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Portal Base URL
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md bg-muted px-3 py-2 font-mono text-sm break-all">
                {portalUrl}
              </code>
              <CopyUrlButton url={portalUrl} label="Copy URL" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              SSO Login Endpoint
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md bg-muted px-3 py-2 font-mono text-sm break-all">
                {portalUrl}/login?app_id=YOUR_APP_ID&redirect_uri=YOUR_CALLBACK
              </code>
              <CopyUrlButton
                url={`${portalUrl}/login?app_id=YOUR_APP_ID&redirect_uri=YOUR_CALLBACK`}
                label="Copy"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Code Exchange Endpoint
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md bg-muted px-3 py-2 font-mono text-sm break-all">
                {portalUrl}/api/auth/exchange
              </code>
              <CopyUrlButton url={`${portalUrl}/api/auth/exchange`} label="Copy" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            See the{' '}
            <Link
              href="/docs/sso-integration-guide"
              className="text-primary underline underline-offset-2 hover:no-underline"
            >
              SSO Integration Guide
            </Link>{' '}
            for implementation details.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
