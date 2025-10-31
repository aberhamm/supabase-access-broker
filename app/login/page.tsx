'use client';

import React, { useState, useEffect } from 'react';
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
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const supabase = createClient();
  const router = useRouter();
  const passwordInputRef = React.useRef<HTMLInputElement>(null);
  const emailInputRef = React.useRef<HTMLInputElement>(null);

  // Focus password field when switching to password mode
  useEffect(() => {
    if (showPassword && passwordInputRef.current) {
      passwordInputRef.current.focus();
    }
  }, [showPassword]);

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
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
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

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast.error('Please enter your email');
      return;
    }

    if (!password) {
      toast.error('Please enter your password');
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Get the 'next' parameter from URL to return user after login
      const params = new URLSearchParams(window.location.search);
      const nextPath = params.get('next') || '/';

      toast.success('Signed in successfully!');
      router.push(nextPath);
    } catch (error) {
      const err = error as { error_description?: string; message?: string };
      toast.error(err.error_description || err.message);
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
          {!showPassword ? (
            <>
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
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Sending magic link...' : 'Send magic link'}
                </Button>
              </form>

              <div className="relative my-4" aria-hidden="true">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or
                  </span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setShowPassword(true)}
                disabled={loading}
                aria-label="Switch to password sign in"
              >
                Sign in with password
              </Button>
            </>
          ) : (
            <>
              <form onSubmit={handlePasswordLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email-password">Email</Label>
                  <Input
                    ref={emailInputRef}
                    id="email-password"
                    type="email"
                    placeholder="admin@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link
                      href="/reset-password"
                      className="text-sm text-muted-foreground hover:text-primary"
                      tabIndex={loading ? -1 : 0}
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <Input
                    ref={passwordInputRef}
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    required
                    autoComplete="current-password"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign in'}
                </Button>
              </form>

              <div className="relative my-4" aria-hidden="true">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or
                  </span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setShowPassword(false);
                  setPassword('');
                }}
                disabled={loading}
                aria-label="Switch to magic link sign in"
              >
                Use magic link instead
              </Button>
            </>
          )}

          <div className="mt-4 space-y-2">
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
