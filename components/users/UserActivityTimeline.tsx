'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
  LogIn,
  Shield,
  Key,
  Mail,
  UserPlus,
  Settings,
  MapPin,
  ChevronRight,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface ActivityEvent {
  id: string;
  type: 'login' | 'claim_added' | 'claim_removed' | 'admin_granted' | 'admin_revoked' | 'password_reset' | 'account_created' | 'email_verified';
  timestamp: string;
  description: string;
  metadata?: {
    ip?: string;
    location?: string;
    claim_key?: string;
    claim_value?: string;
  };
}

interface UserActivityTimelineProps {
  userId: string;
  createdAt: string;
  lastSignIn?: string | null;
  isAdmin: boolean;
}

export function UserActivityTimeline({
  userId,
  createdAt,
  lastSignIn,
  isAdmin,
}: UserActivityTimelineProps) {
  const [showAll, setShowAll] = useState(false);

  // Mock activity data - in production, this would come from an API
  const mockEvents: ActivityEvent[] = [
    lastSignIn && {
      id: '1',
      type: 'login',
      timestamp: lastSignIn,
      description: 'Signed in to account',
      metadata: {
        ip: '192.168.1.1',
        location: 'San Francisco, CA',
      },
    },
    isAdmin && {
      id: '2',
      type: 'admin_granted',
      timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      description: 'Granted admin privileges',
    },
    {
      id: '3',
      type: 'claim_added',
      timestamp: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      description: 'Custom claim added',
      metadata: {
        claim_key: 'role',
        claim_value: 'editor',
      },
    },
    {
      id: '4',
      type: 'email_verified',
      timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      description: 'Email address verified',
    },
    {
      id: '5',
      type: 'account_created',
      timestamp: createdAt,
      description: 'Account created',
    },
  ].filter(Boolean) as ActivityEvent[];

  const displayEvents = showAll ? mockEvents : mockEvents.slice(0, 5);

  const getEventIcon = (type: ActivityEvent['type']) => {
    switch (type) {
      case 'login':
        return LogIn;
      case 'claim_added':
      case 'claim_removed':
        return Key;
      case 'admin_granted':
      case 'admin_revoked':
        return Shield;
      case 'password_reset':
        return Settings;
      case 'account_created':
        return UserPlus;
      case 'email_verified':
        return Mail;
      default:
        return Clock;
    }
  };

  const getEventColor = (type: ActivityEvent['type']) => {
    switch (type) {
      case 'login':
        return 'text-success bg-success/10';
      case 'admin_granted':
        return 'text-primary bg-primary/10';
      case 'admin_revoked':
      case 'claim_removed':
        return 'text-warning bg-warning/10';
      case 'password_reset':
        return 'text-accent-vivid bg-accent-vivid/10';
      case 'account_created':
      case 'email_verified':
        return 'text-muted-foreground bg-muted';
      default:
        return 'text-muted-foreground bg-muted';
    }
  };

  return (
    <Card className="animate-reveal" style={{ animationDelay: '0.3s' }}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Activity Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-0">
          {displayEvents.map((event, index) => {
            const Icon = getEventIcon(event.type);
            const isLast = index === displayEvents.length - 1;

            return (
              <div key={event.id} className="relative group">
                {/* Timeline line */}
                {!isLast && (
                  <div className="absolute left-[19px] top-10 bottom-0 w-px bg-border" />
                )}

                <div className="flex gap-4 pb-6">
                  {/* Icon */}
                  <div
                    className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-4 ring-background ${getEventColor(event.type)}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 pt-1 space-y-2">
                    <div>
                      <p className="font-medium text-sm">{event.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(event.timestamp), {
                          addSuffix: true,
                        })}{' '}
                        · {format(new Date(event.timestamp), 'PPp')}
                      </p>
                    </div>

                    {/* Metadata */}
                    {event.metadata && (
                      <div className="flex flex-wrap gap-2">
                        {event.metadata.ip && (
                          <Badge variant="outline" className="gap-1 text-xs">
                            <MapPin className="h-3 w-3" />
                            {event.metadata.ip}
                          </Badge>
                        )}
                        {event.metadata.location && (
                          <Badge variant="outline" className="text-xs">
                            {event.metadata.location}
                          </Badge>
                        )}
                        {event.metadata.claim_key && (
                          <Badge variant="outline" className="gap-1 font-mono text-xs">
                            {event.metadata.claim_key}
                            {event.metadata.claim_value && (
                              <>
                                <ChevronRight className="h-3 w-3" />
                                {event.metadata.claim_value}
                              </>
                            )}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {mockEvents.length > 5 && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? 'Show Less' : `Show ${mockEvents.length - 5} More Events`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
