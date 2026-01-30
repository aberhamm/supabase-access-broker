'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mail, Phone, User, Hash, Calendar, Clock, Copy, Check } from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';

interface EnhancedUserInfoCardProps {
  email: string;
  phone?: string | null;
  displayName?: string;
  userId: string;
  isAdmin: boolean;
  createdAt: string;
  lastSignIn?: string | null;
  onEdit?: () => void;
}

export function EnhancedUserInfoCard({
  email,
  phone,
  displayName,
  userId,
  isAdmin,
  createdAt,
  lastSignIn,
  onEdit,
}: EnhancedUserInfoCardProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const InfoField = ({
    icon: Icon,
    label,
    value,
    copiable = false,
    fieldKey = '',
  }: {
    icon: React.ElementType;
    label: string;
    value: string;
    copiable?: boolean;
    fieldKey?: string;
  }) => (
    <div className="group">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
      </div>
      <div className="flex items-center gap-2">
        <p className="text-sm flex-1 break-all">{value}</p>
        {copiable && (
          <button
            onClick={() => copyToClipboard(value, fieldKey)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded"
          >
            {copiedField === fieldKey ? (
              <Check className="h-3.5 w-3.5 text-success" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <Card className="animate-reveal">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg">User Information</CardTitle>
        {onEdit && (
          <button
            onClick={onEdit}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Edit
          </button>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        <InfoField icon={Mail} label="Email" value={email} copiable fieldKey="email" />

        {phone && (
          <InfoField icon={Phone} label="Phone" value={phone} copiable fieldKey="phone" />
        )}

        {displayName && <InfoField icon={User} label="Display Name" value={displayName} />}

        <div className="group">
          <div className="flex items-center gap-2 mb-1.5">
            <Hash className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">User ID</p>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-muted px-3 py-2 text-xs font-mono break-all">
              {userId}
            </code>
            <button
              onClick={() => copyToClipboard(userId, 'userId')}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-muted rounded shrink-0"
            >
              {copiedField === 'userId' ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <Copy className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </div>
        </div>

        <div className="pt-4 border-t space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Badge variant={isAdmin ? 'default' : 'outline'}>
                {isAdmin ? 'Claims Admin' : 'Standard User'}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">Created</p>
              </div>
              <p className="text-sm">{format(new Date(createdAt), 'PPP')}</p>
            </div>

            {lastSignIn && (
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium text-muted-foreground">Last Sign In</p>
                </div>
                <p className="text-sm">{format(new Date(lastSignIn), 'PPP p')}</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
