import { useState, useRef, useCallback } from 'react';

export type DripStatus = 'idle' | 'dripping' | 'funded' | 'skipped' | 'error';

export function useDrip() {
  const [status, setStatus] = useState<DripStatus>('idle');
  const requested = useRef(new Set<string>());

  const requestDrip = useCallback(async (address: string) => {
    const normalized = address.toLowerCase();
    if (requested.current.has(normalized)) return;
    requested.current.add(normalized);

    setStatus('dripping');

    try {
      const res = await fetch('/api/drip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });

      if (res.ok) {
        setStatus('funded');
      } else if (res.status === 409) {
        // Already funded — silent
        setStatus('skipped');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }, []);

  return { dripStatus: status, requestDrip };
}
