import { useState, useCallback } from 'react';

export function useCopy(timeoutMs: number = 1500) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), timeoutMs);
    } catch {
      setCopied(false);
    }
  }, [timeoutMs]);

  return { copied, copy };
}
