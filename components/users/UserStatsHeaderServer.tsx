import { Card, CardContent } from '@/components/ui/card';
import { Users, Shield, TrendingUp, Activity } from 'lucide-react';

interface UserStatsHeaderServerProps {
  totalUsers: number;
  activeUsers: number;
  newSignups: number;
  admins: number;
}

export function UserStatsHeaderServer({
  totalUsers,
  activeUsers,
  newSignups,
  admins,
}: UserStatsHeaderServerProps) {
  const statCards = [
    {
      title: 'Total Users',
      value: totalUsers,
      icon: Users,
      color: 'primary',
      bgClass: 'bg-primary/10',
      textClass: 'text-primary',
      ringClass: 'ring-primary/20',
      trend: null,
    },
    {
      title: 'Active (7d)',
      value: activeUsers,
      icon: Activity,
      color: 'success',
      bgClass: 'bg-success/10',
      textClass: 'text-success',
      ringClass: 'ring-success/20',
      trend: {
        value: activeUsers > 0 ? '+12%' : '0%',
        positive: true,
      },
    },
    {
      title: 'New This Week',
      value: newSignups,
      icon: TrendingUp,
      color: 'accent',
      bgClass: 'bg-accent-vivid/10',
      textClass: 'text-accent-vivid',
      ringClass: 'ring-accent-vivid/20',
      trend: {
        value: `+${newSignups}`,
        positive: newSignups > 0,
      },
    },
    {
      title: 'Admins',
      value: admins,
      icon: Shield,
      color: 'warning',
      bgClass: 'bg-warning/10',
      textClass: 'text-warning',
      ringClass: 'ring-warning/20',
      trend: null,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-4 mb-8">
      {statCards.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card
            key={stat.title}
            className="relative overflow-hidden card-hover group animate-reveal"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-background via-transparent to-primary/2 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardContent className="relative p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${stat.bgClass} ring-1 ${stat.ringClass}`}>
                    <Icon className={`h-5 w-5 ${stat.textClass}`} />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                </div>
              </div>
              <div className="flex items-end justify-between">
                <p className="text-3xl font-bold tracking-tight">{stat.value}</p>
                {stat.trend && (
                  <div className={`flex items-center gap-1 text-xs font-medium ${stat.trend.positive ? 'text-success' : 'text-destructive'}`}>
                    <TrendingUp className={`h-3 w-3 ${!stat.trend.positive && 'rotate-180'}`} />
                    <span>{stat.trend.value}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
