'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { StepUpMFAModal } from './StepUpMFAModal';

/**
 * Step-up MFA flow.
 *
 * Wrap your dashboard tree once with <StepUpProvider/> and any descendant
 * client component can call useStepUp() to request a session elevation:
 *
 *   const { withStepUp } = useStepUp();
 *
 *   const result = await withStepUp(
 *     () => createApiKey(data),
 *     'Confirm to issue a new API key',
 *   );
 *
 * `withStepUp` calls the action; if the action returns a step-up code (or
 * throws an error carrying one), the modal opens. Once the user verifies,
 * the action is retried automatically. If the user cancels, the original
 * step-up failure result is returned.
 */

type Codeful = {
  code?: string | null;
  success?: boolean;
  ok?: boolean;
  error?: string | null;
};

const MFA_STEP_UP_REQUIRED = 'MFA_STEP_UP_REQUIRED';
const MFA_ENROLLMENT_REQUIRED = 'MFA_ENROLLMENT_REQUIRED';

function needsStepUp(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const v = value as Codeful;
  if (v.code === MFA_STEP_UP_REQUIRED || v.code === MFA_ENROLLMENT_REQUIRED) return true;
  // Some actions throw with a wrapped Error; the message includes the code
  // when we re-wrap, so callers using try/catch can also check.
  return false;
}

interface StepUpContextValue {
  /** Open the step-up modal and resolve when the user verifies (true) or cancels (false). */
  elevate: (reason?: string) => Promise<boolean>;
  /**
   * Run an action; if it asks for step-up, prompt the user, then retry on
   * success. Returns the action's final result either way.
   */
  withStepUp: <T>(run: () => Promise<T>, reason?: string) => Promise<T>;
}

const StepUpContext = createContext<StepUpContextValue | null>(null);

export function useStepUp(): StepUpContextValue {
  const ctx = useContext(StepUpContext);
  if (!ctx) {
    throw new Error('useStepUp must be used within <StepUpProvider>');
  }
  return ctx;
}

export function StepUpProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | undefined>();
  const resolverRef = useRef<((elevated: boolean) => void) | null>(null);

  const elevate = useCallback((reasonText?: string) => {
    setReason(reasonText);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const handleClose = useCallback((elevated: boolean) => {
    setOpen(false);
    const resolver = resolverRef.current;
    resolverRef.current = null;
    if (resolver) resolver(elevated);
  }, []);

  const withStepUp = useCallback(
    async <T,>(run: () => Promise<T>, reasonText?: string): Promise<T> => {
      let result: T;
      try {
        result = await run();
      } catch (err) {
        const code = (err as { code?: string } | null)?.code;
        if (code === MFA_STEP_UP_REQUIRED || code === MFA_ENROLLMENT_REQUIRED) {
          const elevated = await elevate(reasonText);
          if (!elevated) throw err;
          return run();
        }
        throw err;
      }

      if (needsStepUp(result)) {
        const elevated = await elevate(reasonText);
        if (!elevated) return result;
        return run();
      }

      return result;
    },
    [elevate],
  );

  return (
    <StepUpContext.Provider value={{ elevate, withStepUp }}>
      {children}
      <StepUpMFAModal open={open} reason={reason} onClose={handleClose} />
    </StepUpContext.Provider>
  );
}
