'use client';

import { Spinner } from '@/components/ui/spinner';

type TransitionOverlayProps = {
  visible: boolean;
  message?: string;
};

export function TransitionOverlay({ visible, message = 'Signing you in...' }: TransitionOverlayProps) {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in-0 duration-200">
      <div className="flex flex-col items-center gap-4 animate-in zoom-in-95 duration-300">
        <div className="relative">
          <Spinner size="lg" className="text-primary" />
        </div>
        <p className="text-sm font-medium text-muted-foreground animate-pulse">
          {message}
        </p>
      </div>
    </div>
  );
}
