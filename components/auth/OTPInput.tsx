'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type OTPInputProps = {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
};

export function OTPInput({ length = 6, value, onChange, disabled, className }: OTPInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  const chars = useMemo(() => {
    const clean = value.replace(/\D/g, '').slice(0, length);
    return Array.from({ length }, (_, i) => clean[i] || '');
  }, [length, value]);

  useEffect(() => {
    refs.current = refs.current.slice(0, length);
  }, [length]);

  const setChar = (idx: number, ch: string) => {
    const next = chars.slice();
    next[idx] = ch;
    onChange(next.join(''));
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text') || '';
    const digits = text.replace(/\D/g, '').slice(0, length);
    if (!digits) return;
    onChange(digits);
    const focusIdx = Math.min(digits.length, length - 1);
    refs.current[focusIdx]?.focus();
  };

  return (
    <div className={cn('flex gap-2', className)}>
      {chars.map((ch, idx) => (
        <Input
          key={idx}
          ref={(el) => {
            refs.current[idx] = el;
          }}
          value={ch}
          onPaste={handlePaste}
          onChange={(e) => {
            const digit = e.target.value.replace(/\D/g, '').slice(-1);
            setChar(idx, digit);
            if (digit && idx < length - 1) refs.current[idx + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace') {
              if (chars[idx]) {
                setChar(idx, '');
              } else if (idx > 0) {
                refs.current[idx - 1]?.focus();
                setChar(idx - 1, '');
              }
            }
            if (e.key === 'ArrowLeft' && idx > 0) refs.current[idx - 1]?.focus();
            if (e.key === 'ArrowRight' && idx < length - 1) refs.current[idx + 1]?.focus();
          }}
          inputMode="numeric"
          autoComplete={idx === 0 ? 'one-time-code' : 'off'}
          aria-label={`Digit ${idx + 1}`}
          className="h-12 w-10 text-center text-lg"
          maxLength={1}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
