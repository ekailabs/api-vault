'use client';

import { useCallback, useEffect, useState } from 'react';
import { getApiBaseUrl } from '@/lib/api';

const GATEWAY_REPO_URL = 'https://github.com/ekailabs/ekai-gateway/tree/oasis-deployment';
const HEALTH_TIMEOUT_MS = 4000;
const HEALTH_POLL_MS = 30000;

type BackendStatus = 'checking' | 'online' | 'offline' | 'unconfigured';

export default function BackendStatusButton() {
  const [status, setStatus] = useState<BackendStatus>('checking');
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const [detail, setDetail] = useState('Checking gateway health');

  const checkBackend = useCallback(async (showChecking = true) => {
    let apiBaseUrl: string;

    if (showChecking) {
      setStatus('checking');
      setDetail('Checking gateway health');
    }

    try {
      apiBaseUrl = getApiBaseUrl();
      setBaseUrl(apiBaseUrl);
    } catch {
      setBaseUrl(null);
      setStatus('unconfigured');
      setDetail('Gateway URL is not configured. Open the TEE gateway repo to run one.');
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

    try {
      const response = await fetch(`${apiBaseUrl}/health`, {
        cache: 'no-store',
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Health check returned ${response.status}`);
      }

      setStatus('online');
      setDetail(`Gateway online at ${apiBaseUrl}`);
    } catch {
      setStatus('offline');
      setDetail(`Gateway is not reachable at ${apiBaseUrl}. Open the TEE gateway repo to run one.`);
    } finally {
      window.clearTimeout(timeoutId);
    }
  }, []);

  useEffect(() => {
    void checkBackend();
    const intervalId = window.setInterval(() => {
      void checkBackend(false);
    }, HEALTH_POLL_MS);

    return () => window.clearInterval(intervalId);
  }, [checkBackend]);

  const stateClasses: Record<BackendStatus, string> = {
    checking: 'border-gray-200 bg-gray-50 text-gray-600',
    online: 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100',
    offline: 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100',
    unconfigured: 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100',
  };

  const dotClasses: Record<BackendStatus, string> = {
    checking: 'bg-gray-400 animate-pulse',
    online: 'bg-green-500',
    offline: 'bg-amber-500',
    unconfigured: 'bg-amber-500',
  };

  const label: Record<BackendStatus, string> = {
    checking: 'Checking gateway',
    online: 'Gateway online',
    offline: 'Gateway offline',
    unconfigured: 'Gateway setup',
  };

  const className = `inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${stateClasses[status]}`;
  const dot = <span className={`h-2 w-2 shrink-0 rounded-full ${dotClasses[status]}`} aria-hidden="true" />;

  if (status === 'offline' || status === 'unconfigured') {
    return (
      <a
        href={GATEWAY_REPO_URL}
        target="_blank"
        rel="noreferrer"
        className={className}
        title={detail}
        aria-label={`${label[status]}. Open TEE gateway repository`}
      >
        {dot}
        <span>{label[status]}</span>
        <span className="hidden text-xs font-semibold sm:inline">Run TEE</span>
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void checkBackend()}
      disabled={status === 'checking'}
      className={className}
      title={baseUrl ? detail : 'Checking gateway health'}
      aria-label={detail}
    >
      {dot}
      <span>{label[status]}</span>
    </button>
  );
}
