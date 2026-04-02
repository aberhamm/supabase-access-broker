'use client';

import { Spinner } from '@/components/ui/spinner';

type TransitionOverlayProps = {
  visible: boolean;
};

/**
 * Apple-style transition: the entire login card content fades away and a
 * single calm spinner takes its place. No modal overlay, no verbose text —
 * the animation itself communicates progress.
 *
 * Rendered *inside* the card, not on top of the page.
 */
export function AuthTransition({ visible }: TransitionOverlayProps) {
  if (!visible) return null;

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] bg-card auth-transition-in">
      <div className="flex flex-col items-center gap-5">
        {/* Breathing glow behind spinner */}
        <div className="relative">
          <div className="absolute inset-0 -m-3 rounded-full bg-primary/10 auth-breathe" />
          <Spinner size="lg" className="text-primary" />
        </div>
      </div>
    </div>
  );
}
