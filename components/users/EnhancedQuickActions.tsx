'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Shield,
  ShieldOff,
  KeyRound,
  RefreshCw,
  Trash2,
  Mail,
  AlertTriangle,
} from 'lucide-react';

interface EnhancedQuickActionsProps {
  userId: string;
  isAdmin: boolean;
  onToggleAdmin?: () => void;
  onResetPassword?: () => void;
  onSendVerification?: () => void;
  onRefreshSession?: () => void;
  onDelete?: () => void;
}

export function EnhancedQuickActions({
  userId,
  isAdmin,
  onToggleAdmin,
  onResetPassword,
  onSendVerification,
  onRefreshSession,
  onDelete,
}: EnhancedQuickActionsProps) {
  return (
    <Card className="animate-reveal" style={{ animationDelay: '0.2s' }}>
      <CardHeader>
        <CardTitle className="text-lg">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Security Actions */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Security
          </p>

          {onToggleAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={onToggleAdmin}
            >
              {isAdmin ? (
                <>
                  <ShieldOff className="h-4 w-4" />
                  Remove Admin Access
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4" />
                  Grant Admin Access
                </>
              )}
            </Button>
          )}

          {onResetPassword && (
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={onResetPassword}
            >
              <KeyRound className="h-4 w-4" />
              Reset Password
            </Button>
          )}

          {onSendVerification && (
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={onSendVerification}
            >
              <Mail className="h-4 w-4" />
              Send Verification Email
            </Button>
          )}
        </div>

        {/* Account Actions */}
        <div className="space-y-2 pt-3 border-t">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Account
          </p>

          {onRefreshSession && (
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="flex items-start gap-2 mb-2">
                <RefreshCw className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium mb-1">Session Refresh</p>
                  <p className="text-xs text-muted-foreground">
                    User must log out and back in to see claim updates
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2"
                onClick={onRefreshSession}
              >
                Generate Refresh Link
              </Button>
            </div>
          )}
        </div>

        {/* Danger Zone */}
        {onDelete && (
          <div className="space-y-2 pt-3 border-t">
            <p className="text-xs font-medium text-destructive uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3" />
              Danger Zone
            </p>

            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2 hover:bg-destructive hover:text-destructive-foreground hover:border-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
              Delete User Account
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
