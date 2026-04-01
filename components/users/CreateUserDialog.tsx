'use client';

import { CreateUserWizard } from './CreateUserWizard';
import type { AppConfig } from '@/types/claims';

interface CreateUserDialogProps {
  apps?: AppConfig[];
  onUserCreated?: () => void;
}

export function CreateUserDialog({ apps, onUserCreated }: CreateUserDialogProps) {
  return <CreateUserWizard apps={apps} onComplete={onUserCreated} />;
}
