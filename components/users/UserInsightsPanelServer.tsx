import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  BarChart3,
  Shield,
  Zap,
  AlertCircle,
  CheckCircle2,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface UserInsightsPanelServerProps {
  userId: string;
  isAdmin: boolean;
  claimsCount: number;
  appsCount: number;
  hasMFA: boolean;
  emailVerified: boolean;
  lastSignInDays?: number;
}

export function UserInsightsPanelServer({
  userId,
  isAdmin,
  claimsCount,
  appsCount,
  hasMFA,
  emailVerified,
  lastSignInDays = 99,
}: UserInsightsPanelServerProps) {
  // Calculate engagement score (server-side)
  const engagementFactors = [
    lastSignInDays <= 7 ? 30 : lastSignInDays <= 30 ? 15 : 0,
    hasMFA ? 25 : 0,
    emailVerified ? 15 : 0,
    Math.min(claimsCount * 5, 30),
    Math.min(appsCount * 10, 30),
  ];

  const engagementScore = Math.min(
    100,
    engagementFactors.reduce((sum, val) => sum + val, 0)
  );

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-success';
    if (score >= 50) return 'text-primary';
    if (score >= 30) return 'text-warning';
    return 'text-destructive';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 50) return 'Good';
    if (score >= 30) return 'Fair';
    return 'Low';
  };

  // Generate recommendations (server-side)
  const recommendations = [];
  if (!hasMFA) {
    recommendations.push({
      icon: Shield,
      title: 'Enable MFA',
      description: 'Add multi-factor authentication for better security',
      priority: 'high' as const,
    });
  }
  if (!emailVerified) {
    recommendations.push({
      icon: AlertCircle,
      title: 'Verify Email',
      description: 'Send verification email to confirm address',
      priority: 'high' as const,
    });
  }
  if (claimsCount === 0) {
    recommendations.push({
      icon: Zap,
      title: 'Add Claims',
      description: 'Configure custom claims for this user',
      priority: 'medium' as const,
    });
  }
  if (appsCount === 0) {
    recommendations.push({
      icon: BarChart3,
      title: 'Grant App Access',
      description: 'Give user access to applications',
      priority: 'medium' as const,
    });
  }

  return (
    <Card className="animate-reveal" style={{ animationDelay: '0.4s' }}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          User Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Engagement Score */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">
              Engagement Score
            </span>
            <span className={`text-sm font-bold ${getScoreColor(engagementScore)}`}>
              {getScoreLabel(engagementScore)}
            </span>
          </div>
          <div className="relative w-full bg-muted rounded-full h-3 overflow-hidden mb-2">
            <div
              className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
                engagementScore >= 80
                  ? 'bg-gradient-to-r from-success to-success/80'
                  : engagementScore >= 50
                    ? 'bg-gradient-to-r from-primary to-primary/80'
                    : engagementScore >= 30
                      ? 'bg-gradient-to-r from-warning to-warning/80'
                      : 'bg-gradient-to-r from-destructive to-destructive/80'
              }`}
              style={{ width: `${engagementScore}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Based on activity, security, and platform usage
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border p-3 space-y-1">
            <p className="text-xs text-muted-foreground">Claims</p>
            <p className="text-2xl font-bold">{claimsCount}</p>
          </div>
          <div className="rounded-lg border p-3 space-y-1">
            <p className="text-xs text-muted-foreground">Apps</p>
            <p className="text-2xl font-bold">{appsCount}</p>
          </div>
          <div className="rounded-lg border p-3 space-y-1">
            <p className="text-xs text-muted-foreground">Security</p>
            <div className="flex items-center gap-1">
              {hasMFA ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <p className="text-sm font-medium text-success">MFA</p>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-warning" />
                  <p className="text-sm font-medium text-warning">Basic</p>
                </>
              )}
            </div>
          </div>
          <div className="rounded-lg border p-3 space-y-1">
            <p className="text-xs text-muted-foreground">Status</p>
            <div className="flex items-center gap-1">
              {lastSignInDays <= 7 ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  <p className="text-sm font-medium">Active</p>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />
                  <p className="text-sm font-medium text-muted-foreground">Inactive</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Recommendations</p>
            <div className="space-y-2">
              {recommendations.map((rec, index) => {
                const Icon = rec.icon;
                return (
                  <div
                    key={index}
                    className={`flex items-start gap-3 rounded-lg border p-3 ${
                      rec.priority === 'high'
                        ? 'border-warning/50 bg-warning/5'
                        : 'bg-muted/50'
                    }`}
                  >
                    <div
                      className={`p-1.5 rounded ${
                        rec.priority === 'high'
                          ? 'bg-warning/10 text-warning'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium mb-0.5">{rec.title}</p>
                      <p className="text-xs text-muted-foreground">{rec.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {recommendations.length === 0 && (
          <div className="rounded-lg border border-success/50 bg-success/5 p-4 text-center space-y-2">
            <CheckCircle2 className="h-8 w-8 text-success mx-auto" />
            <div>
              <p className="font-medium text-success">All Set!</p>
              <p className="text-xs text-muted-foreground">
                This user account is well-configured
              </p>
            </div>
          </div>
        )}

        {/* Related Users */}
        <div className="space-y-3 pt-3 border-t">
          <p className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Related Users
          </p>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="font-mono">
                @{userId.split('@')[0]?.substring(0, 8) || 'domain'}
              </Badge>
              <span>Same domain: 12 users</span>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="gap-1">
                  <Shield className="h-3 w-3" />
                  Admin
                </Badge>
                <span>5 total admins</span>
              </div>
            )}
          </div>
          <Button variant="outline" size="sm" className="w-full">
            View Similar Users
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
