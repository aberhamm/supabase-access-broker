'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { toast } from 'sonner';
import { getAppUrl } from '@/lib/app-url';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const emailInputRef = React.useRef<HTMLInputElement>(null);

  const handleMagicLinkLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast.error('Please enter your email');
      return;
    }

    try {
      setLoading(true);

      // Get the 'next' parameter from URL to return user after login
      const params = new URLSearchParams(window.location.search);
      const nextPath = params.get('next') || '/';

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${getAppUrl()}/auth/callback?next=${encodeURIComponent(nextPath)}`,
          shouldCreateUser: false,
        },
      });

      if (error) throw error;

      toast.success('Check your email for the magic link!');
    } catch (error) {
      const err = error as { error_description?: string; message?: string };
      const errorMessage = err.error_description || err.message || '';

      // Provide helpful error messages
      if (errorMessage.toLowerCase().includes('user not found') ||
          errorMessage.toLowerCase().includes('invalid email')) {
        toast.error('This email is not registered. Contact an administrator to get access.');
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Claims Admin</CardTitle>
          <CardDescription>
            Sign in to manage Supabase custom claims
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleMagicLinkLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                ref={emailInputRef}
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
                autoComplete="email"
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Sending magic link...' : 'Send magic link'}
            </Button>
          </form>

          <div className="mt-6 space-y-2">
            <p className="text-center text-sm text-muted-foreground">
              Only existing users with <code className="rounded bg-muted px-1 py-0.5">claims_admin</code> access can sign in
            </p>
            <p className="text-center text-xs text-muted-foreground">
              New users must be created by an administrator
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
