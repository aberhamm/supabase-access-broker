'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { WizardStepIndicator } from './wizard/WizardStepIndicator';
import { IdentityStep } from './wizard/IdentityStep';
import { AppAccessStep, type AppSelection } from './wizard/AppAccessStep';
import { getAppsAction } from '@/app/actions/apps';
import { grantMultiAppAccess } from '@/app/actions/users';
import type { AppConfig } from '@/types/claims';
import { useStepUp } from '@/components/auth/StepUpProvider';

const WIZARD_STEPS = [
  { label: 'Identity' },
  { label: 'App Access' },
];

interface CreateUserWizardProps {
  preselectedAppId?: string;
  apps?: AppConfig[];
  trigger?: React.ReactNode;
  onComplete?: () => void;
}

export function CreateUserWizard({
  preselectedAppId,
  apps: appsProp,
  trigger,
  onComplete,
}: CreateUserWizardProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [createdUserId, setCreatedUserId] = useState<string | null>(null);
  const { withStepUp } = useStepUp();
  const [createdEmail, setCreatedEmail] = useState('');
  const [apps, setApps] = useState<AppConfig[]>(appsProp || []);
  const [selections, setSelections] = useState<Record<string, AppSelection>>({});
  const router = useRouter();

  // Fetch apps if not provided as prop
  useEffect(() => {
    if (!appsProp && open) {
      getAppsAction().then((result) => {
        if (result.data) setApps(result.data);
      });
    }
  }, [appsProp, open]);

  // Initialize preselected app
  useEffect(() => {
    if (preselectedAppId && open) {
      setSelections((prev) => ({
        ...prev,
        [preselectedAppId]: { selected: true, role: 'user' },
      }));
    }
  }, [preselectedAppId, open]);

  const reset = () => {
    setStep(0);
    setCreatedUserId(null);
    setCreatedEmail('');
    setSelections(
      preselectedAppId
        ? { [preselectedAppId]: { selected: true, role: 'user' } }
        : {}
    );
    setLoading(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) reset();
  };

  const handleUserCreated = (userId: string, email: string) => {
    setCreatedUserId(userId);
    setCreatedEmail(email);
    setStep(1);
  };

  const navigateToUser = () => {
    router.push(`/users/${createdUserId}`);
    router.refresh();
    setOpen(false);
    onComplete?.();
  };

  const handleFinish = async () => {
    if (!createdUserId) return;

    const selectedApps = Object.entries(selections)
      .filter(([, sel]) => sel.selected)
      .map(([appId, sel]) => ({ appId, role: sel.role }));

    if (selectedApps.length === 0) {
      navigateToUser();
      return;
    }

    setLoading(true);
    let result;
    try {
      result = await withStepUp(
        () => grantMultiAppAccess(createdUserId, selectedApps),
        'Confirm to grant app access',
      );
    } finally {
      setLoading(false);
    }

    if (result.errors.length > 0) {
      result.errors.forEach((err) => toast.error(err));
      if (!result.success) return;
    }

    toast.success(
      `Granted access to ${selectedApps.length} app${selectedApps.length > 1 ? 's' : ''}`
    );
    navigateToUser();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <UserPlus className="mr-2 h-4 w-4" />
            Create User
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
          <DialogDescription>
            {step === 0
              ? 'Create a new user account with a password or send them an invitation email.'
              : 'Grant the new user access to your apps.'}
          </DialogDescription>
        </DialogHeader>

        <div className="mb-2">
          <WizardStepIndicator steps={WIZARD_STEPS} currentStep={step} />
        </div>

        {step === 0 && (
          <IdentityStep
            onUserCreated={handleUserCreated}
            onCancel={() => setOpen(false)}
            loading={loading}
            setLoading={setLoading}
          />
        )}

        {step === 1 && (
          <AppAccessStep
            apps={apps}
            selections={selections}
            onSelectionsChange={setSelections}
            createdEmail={createdEmail}
            onFinish={handleFinish}
            onSkip={navigateToUser}
            loading={loading}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
