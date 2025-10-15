'use client';

import { useState } from 'react';
import { Copy, Check, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CopyDocButtonProps {
  content: string;
}

export function CopyDocButton({ content }: CopyDocButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <Button
      onClick={handleCopy}
      variant="outline"
      className="gap-2"
      size="sm"
    >
      {copied ? (
        <>
          <Check className="h-4 w-4" />
          Copied!
        </>
      ) : (
        <>
          <Bot className="h-4 w-4" />
          <Copy className="h-4 w-4" />
          Copy for LLM
        </>
      )}
    </Button>
  );
}
