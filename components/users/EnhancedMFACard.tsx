'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Smartphone, Key, CheckCircle2, Clock, Plus, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface MFAFactor {
  id: string;
  factor_type: string;
  friendly_name?: string;
  status: string;
  created_at: string;
  updated_at: string;
  last_challenged_at?: string | null;
}

interface EnhancedMFACardProps {
  factors: MFAFactor[];
  userId: string;
}

export function EnhancedMFACard({ factors, userId }: EnhancedMFACardProps) {
  const getFactorIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'totp':
        return ShieldCheck;
      case 'phone':
        return Smartphone;
      case 'webauthn':
        return Key;
      default:
        return ShieldCheck;
    }
  };

  const getFactorLabel = (type: string) => {
    switch (type.toLowerCase()) {
      case 'totp':
        return 'Authenticator App';
      case 'phone':
        return 'SMS Authentication';
      case 'webauthn':
        return 'Security Key';
      default:
        return type;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'verified':
        return 'default';
      case 'unverified':
        return 'warning';
      default:
        return 'outline';
    }
  };

  const securityScore = factors.filter((f) => f.status.toLowerCase() === 'verified').length;
  const maxScore = 3; // TOTP, Phone, WebAuthn

  return (
    <Card className="animate-reveal" style={{ animationDelay: '0.1s' }}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Multi-Factor Authentication
          </CardTitle>
          <Badge
            variant={securityScore > 0 ? 'default' : 'outline'}
            className="gap-1"
          >
            {securityScore}/{maxScore}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Security Score Indicator */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Security Level</span>
            <span className="font-medium">
              {securityScore === 0 && 'None'}
              {securityScore === 1 && 'Basic'}
              {securityScore === 2 && 'Strong'}
              {securityScore === 3 && 'Maximum'}
            </span>
          </div>
          <div className="relative w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
                securityScore === 0
                  ? 'bg-muted-foreground/20'
                  : securityScore === 1
                    ? 'bg-warning'
                    : securityScore === 2
                      ? 'bg-primary'
                      : 'bg-success'
              }`}
              style={{ width: `${(securityScore / maxScore) * 100}%` }}
            />
          </div>
        </div>

        {/* Factor List */}
        {factors.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center space-y-3">
            <div className="flex justify-center">
              <div className="p-3 rounded-full bg-warning/10 text-warning">
                <AlertCircle className="h-6 w-6" />
              </div>
            </div>
            <div>
              <p className="font-medium mb-1">No MFA Configured</p>
              <p className="text-sm text-muted-foreground">
                Enhance account security by enabling multi-factor authentication
              </p>
            </div>
            <Button size="sm" variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Add MFA Factor
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {factors.map((factor) => {
              const Icon = getFactorIcon(factor.factor_type);
              const isVerified = factor.status.toLowerCase() === 'verified';

              return (
                <div
                  key={factor.id}
                  className="group relative overflow-hidden rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2 rounded-lg ${
                        isVerified ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm">
                          {factor.friendly_name || getFactorLabel(factor.factor_type)}
                        </p>
                        <Badge
                          variant={getStatusColor(factor.status) as 'default' | 'outline' | 'warning'}
                          className="text-xs"
                        >
                          {isVerified && <CheckCircle2 className="h-3 w-3 mr-1" />}
                          {factor.status}
                        </Badge>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          Added {formatDistanceToNow(new Date(factor.created_at), { addSuffix: true })}
                        </div>
                        {factor.last_challenged_at && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CheckCircle2 className="h-3 w-3" />
                            Last used{' '}
                            {formatDistanceToNow(new Date(factor.last_challenged_at), {
                              addSuffix: true,
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {factors.length > 0 && factors.length < maxScore && (
          <Button variant="outline" size="sm" className="w-full gap-2">
            <Plus className="h-4 w-4" />
            Add Another Factor
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
