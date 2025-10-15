'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { COMMON_ROLES } from '@/lib/apps-config';

interface AppRoleSelectorProps {
  currentRole: string;
  onRoleChange: (role: string) => void;
  disabled?: boolean;
}

export function AppRoleSelector({
  currentRole,
  onRoleChange,
  disabled = false,
}: AppRoleSelectorProps) {
  return (
    <Select value={currentRole} onValueChange={onRoleChange} disabled={disabled}>
      <SelectTrigger className="w-[140px]">
        <SelectValue placeholder="Select role" />
      </SelectTrigger>
      <SelectContent>
        {COMMON_ROLES.map((role) => (
          <SelectItem key={role.value} value={role.value}>
            <div>
              <div className="font-medium">{role.label}</div>
              <div className="text-xs text-muted-foreground">
                {role.description}
              </div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
